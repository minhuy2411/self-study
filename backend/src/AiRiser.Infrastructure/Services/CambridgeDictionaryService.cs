using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AiRiser.Infrastructure.Services
{
    public interface ICambridgeDictionaryService
    {
        Task<CambridgeWordDetailsDto> LookupWordAsync(string word);
    }

    public class CambridgeDictionaryService : ICambridgeDictionaryService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<CambridgeDictionaryService> _logger;
        private readonly string _baseUrl;
        private readonly string? _apiKey;
        private readonly string _completionModel;

        public CambridgeDictionaryService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<CambridgeDictionaryService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;

            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            );
            _httpClient.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9,vi;q=0.8");

            _baseUrl = (configuration["AiSettings:BaseUrl"] ?? "https://api.openai.com/v1").TrimEnd('/');
            _apiKey = configuration["AiSettings:ApiKey"] ?? configuration["AiSettings:OpenAiApiKey"];
            _completionModel = configuration["AiSettings:CompletionModel"] ?? "openai/gpt-4o-mini";
        }

        public async Task<CambridgeWordDetailsDto> LookupWordAsync(string word)
        {
            var cleanWord = word.Trim().ToLowerInvariant();
            var result = new CambridgeWordDetailsDto
            {
                Word = word.Trim(),
                SourceUrl = $"https://dictionary.cambridge.org/dictionary/english/{Uri.EscapeDataString(cleanWord)}"
            };

            // 1. Attempt live scrape from Cambridge Dictionary
            try
            {
                var response = await _httpClient.GetAsync(result.SourceUrl);
                if (response.IsSuccessStatusCode)
                {
                    var html = await response.Content.ReadAsStringAsync();
                    ParseCambridgeHtml(html, result);

                    if (!string.IsNullOrEmpty(result.EnglishDefinition))
                    {
                        return result;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Live scrape of Cambridge Dictionary for '{Word}' was blocked or failed.", word);
            }

            // 2. Fallback / RAG: Query LLM with Cambridge Dictionary standard
            if (!string.IsNullOrEmpty(_apiKey) && !_apiKey.StartsWith("YOUR_") && _apiKey.Length > 5)
            {
                try
                {
                    var aiResult = await QueryLlmCambridgeRagAsync(cleanWord);
                    if (aiResult != null)
                    {
                        aiResult.SourceUrl = result.SourceUrl;
                        return aiResult;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "LLM Cambridge RAG fallback failed for '{Word}'.", word);
                }
            }

            // 3. Fallback default
            result.EnglishDefinition ??= $"The meaning and contextual usage of '{word}' in English.";
            return result;
        }

        private void ParseCambridgeHtml(string html, CambridgeWordDetailsDto result)
        {
            try
            {
                // Extract phonetic: <span class="ipa dipa ...">/ˌɪˈrʌp.ʃən/</span>
                var phoneticMatch = Regex.Match(html, @"<span class=""ipa dipa[^""]*"">([^<]+)</span>", RegexOptions.IgnoreCase);
                if (phoneticMatch.Success)
                {
                    result.Phonetic = $"/{phoneticMatch.Groups[1].Value.Trim().Trim('/')}/";
                }

                // Extract Part of Speech: <span class="pos dpos">noun</span>
                var posMatch = Regex.Match(html, @"<span class=""pos dpos"">([^<]+)</span>", RegexOptions.IgnoreCase);
                if (posMatch.Success)
                {
                    result.PartOfSpeech = posMatch.Groups[1].Value.Trim();
                }

                // Extract CEFR Level: <span class="epp-xref dxref">B2</span>
                var cefrMatch = Regex.Match(html, @"<span class=""epp-xref[^""]*"">([A-C][1-2])</span>", RegexOptions.IgnoreCase);
                if (cefrMatch.Success)
                {
                    result.CefrLevel = cefrMatch.Groups[1].Value.Trim();
                }

                // Extract English Definition: <div class="def ddef_d db">...</div>
                var defMatch = Regex.Match(html, @"<div class=""def ddef_d db"">([\s\S]*?)</div>", RegexOptions.IgnoreCase);
                if (defMatch.Success)
                {
                    var rawDef = Regex.Replace(defMatch.Groups[1].Value, "<.*?>", string.Empty);
                    result.EnglishDefinition = Regex.Replace(rawDef, @"\s+", " ").Trim().TrimEnd(':');
                }

                // Extract Example sentences: <span class="eg deg">...</span>
                var exampleMatches = Regex.Matches(html, @"<span class=""eg deg"">([\s\S]*?)</span>", RegexOptions.IgnoreCase);
                foreach (Match m in exampleMatches)
                {
                    var cleanEx = Regex.Replace(m.Groups[1].Value, "<.*?>", string.Empty);
                    var formattedEx = Regex.Replace(cleanEx, @"\s+", " ").Trim();
                    if (!string.IsNullOrEmpty(formattedEx) && !result.Examples.Contains(formattedEx))
                    {
                        result.Examples.Add(formattedEx);
                        if (result.Examples.Count >= 3) break;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error parsing Cambridge HTML structure.");
            }
        }

        private async Task<CambridgeWordDetailsDto?> QueryLlmCambridgeRagAsync(string word)
        {
            var systemPrompt = """
            You are the official Cambridge Advanced Learner's Dictionary (CALD) RAG knowledge agent.
            Provide the precise authoritative Cambridge English definition, CEFR level (A1, A2, B1, B2, C1, C2), IPA phonetics, and authentic natural Cambridge example sentence.

            Output strictly JSON matching this schema:
            {
              "word": "word",
              "phonetic": "/.../",
              "partOfSpeech": "noun | verb | adjective | adverb...",
              "cefrLevel": "B1 | B2 | C1...",
              "englishDefinition": "Authoritative English definition from Cambridge Dictionary",
              "vietnameseTranslation": "Accurate Vietnamese meaning in this context",
              "examples": [
                "Authentic example sentence 1",
                "Authentic example sentence 2"
              ],
              "synonyms": ["synonym1", "synonym2"]
            }
            """;

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/chat/completions");
            httpRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
            httpRequest.Headers.Add("x-api-key", _apiKey);

            var requestBody = new
            {
                model = _completionModel,
                response_format = new { type = "json_object" },
                temperature = 0.2,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = $"Lookup word: {word}" }
                }
            };

            httpRequest.Content = JsonContent.Create(requestBody);
            var httpResponse = await _httpClient.SendAsync(httpRequest);

            if (!httpResponse.IsSuccessStatusCode) return null;

            var responseJson = await httpResponse.Content.ReadFromJsonAsync<JsonElement>();
            var contentString = responseJson.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

            if (string.IsNullOrEmpty(contentString)) return null;

            return JsonSerializer.Deserialize<CambridgeWordDetailsDto>(contentString, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
    }
}
