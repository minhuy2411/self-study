using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UglyToad.PdfPig;

namespace AiRiser.Infrastructure.Services
{
    public interface IDocumentScannerService
    {
        Task<ScanDocumentResultDto> ScanPdfOrTextAsync(Stream? fileStream, string? fileName, string? rawText);
    }

    public class DocumentScannerService : IDocumentScannerService
    {
        private readonly HttpClient _httpClient;
        private readonly ICambridgeDictionaryService _cambridgeService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DocumentScannerService> _logger;
        private readonly string _baseUrl;
        private readonly string? _apiKey;
        private readonly string _completionModel;

        public DocumentScannerService(
            HttpClient httpClient,
            ICambridgeDictionaryService cambridgeService,
            IConfiguration configuration,
            ILogger<DocumentScannerService> logger)
        {
            _httpClient = httpClient;
            _cambridgeService = cambridgeService;
            _configuration = configuration;
            _logger = logger;
            _baseUrl = (configuration["AiSettings:BaseUrl"] ?? "https://api.openai.com/v1").TrimEnd('/');
            _apiKey = configuration["AiSettings:ApiKey"] ?? configuration["AiSettings:OpenAiApiKey"];
            _completionModel = configuration["AiSettings:CompletionModel"] ?? "openai/gpt-4o-mini";
        }

        public async Task<ScanDocumentResultDto> ScanPdfOrTextAsync(Stream? fileStream, string? fileName, string? rawText)
        {
            var sb = new StringBuilder();

            // 1. Extract text from PDF file if provided
            if (fileStream != null && fileStream.Length > 0)
            {
                try
                {
                    using var memoryStream = new MemoryStream();
                    await fileStream.CopyToAsync(memoryStream);
                    memoryStream.Position = 0;

                    using var pdf = PdfDocument.Open(memoryStream);
                    foreach (var page in pdf.GetPages())
                    {
                        sb.AppendLine(page.Text);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse PDF stream. Proceeding with raw text if available.");
                }
            }

            // Append raw text if any
            if (!string.IsNullOrWhiteSpace(rawText))
            {
                sb.AppendLine(rawText);
            }

            var fullText = sb.ToString();
            if (string.IsNullOrWhiteSpace(fullText))
            {
                return new ScanDocumentResultDto
                {
                    DocumentName = fileName ?? "Text",
                    TotalExtractedWords = 0,
                    ExtractedWords = new List<ScannedWordDto>()
                };
            }

            // 2. First attempt high-speed structured pattern extraction (e.g. IELTS/TOEIC PDF lists)
            var extractedWords = ParseStructuredIeltsVocabularyList(fullText);

            // If structured regex found fewer than 2 items, try LLM extraction
            if (extractedWords.Count < 2)
            {
                if (!string.IsNullOrEmpty(_apiKey) && !_apiKey.StartsWith("YOUR_") && _apiKey.Length > 5)
                {
                    try
                    {
                        extractedWords = await ExtractVocabulariesFromTextViaLlmAsync(fullText);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "LLM vocabulary extraction failed. Falling back to heuristic text parsing.");
                        extractedWords = FallbackHeuristicExtractor(fullText);
                    }
                }
                else
                {
                    extractedWords = FallbackHeuristicExtractor(fullText);
                }
            }

            // 3. For any words missing English definition, query Cambridge RAG in parallel
            var wordsToEnrich = extractedWords.Where(w => string.IsNullOrWhiteSpace(w.EnglishMeaning)).Take(20).ToList();
            if (wordsToEnrich.Any())
            {
                var tasks = wordsToEnrich.Select(async w =>
                {
                    try
                    {
                        var details = await _cambridgeService.LookupWordAsync(w.Word);
                        if (details != null)
                        {
                            if (string.IsNullOrWhiteSpace(w.EnglishMeaning))
                                w.EnglishMeaning = details.EnglishDefinition;
                            if (string.IsNullOrWhiteSpace(w.Phonetic) && !string.IsNullOrWhiteSpace(details.Phonetic))
                                w.Phonetic = details.Phonetic;
                            if (string.IsNullOrWhiteSpace(w.CefrLevel) && !string.IsNullOrWhiteSpace(details.CefrLevel))
                                w.CefrLevel = details.CefrLevel;
                        }
                    }
                    catch {}
                });
                await Task.WhenAll(tasks);
            }

            return new ScanDocumentResultDto
            {
                DocumentName = fileName ?? "Tài liệu đã quét",
                TotalExtractedWords = extractedWords.Count,
                ExtractedWords = extractedWords
            };
        }

        private List<ScannedWordDto> ParseStructuredIeltsVocabularyList(string text)
        {
            var list = new List<ScannedWordDto>();

            // Regex pattern matching:
            // Word
            // /phonetic/
            // (partOfSpeech). meaning
            // Example sentence...
            var pattern = @"(?<word>[a-zA-Z\s\-]{2,35})\r?\n(?<phonetic>\/[^\/\r\n]+\/)\r?\n\((?<pos>noun|adj|verb|adv|phrase|conjunction|preposition)[^\)]*\)\.?\s*(?<meaning>[^\r\n]+)(?:\r?\n(?<example>[^\r\n]+))?";
            var matches = Regex.Matches(text, pattern, RegexOptions.IgnoreCase);

            foreach (Match m in matches)
            {
                var word = m.Groups["word"].Value.Trim();
                if (word.Length < 2 || word.Contains("www.") || word.Contains("IELTS") || word.Contains("DOL") || word.Contains("ACADEMY"))
                    continue;

                var phonetic = m.Groups["phonetic"].Value.Trim();
                var pos = m.Groups["pos"].Value.Trim();
                var meaning = m.Groups["meaning"].Value.Trim();
                var example = m.Groups["example"].Success ? m.Groups["example"].Value.Trim() : null;

                if (!list.Any(x => x.Word.Equals(word, StringComparison.OrdinalIgnoreCase)))
                {
                    list.Add(new ScannedWordDto
                    {
                        Word = word,
                        Phonetic = phonetic,
                        PartOfSpeech = pos,
                        Meaning = meaning,
                        Example = example,
                        IsSelected = true
                    });
                }
            }

            return list;
        }

        private async Task<List<ScannedWordDto>> ExtractVocabulariesFromTextViaLlmAsync(string text)
        {
            // Truncate text to a compact prompt to avoid timeout
            var truncated = text.Length > 8000 ? text.Substring(0, 8000) : text;

            var systemPrompt = """
            You are an expert vocabulary extractor in the AI-Riser platform.
            Extract key English vocabulary terms from the text.
            Output JSON:
            {
              "words": [
                {
                  "word": "word",
                  "phonetic": "/.../",
                  "partOfSpeech": "noun | verb | adjective | adverb...",
                  "cefrLevel": "B1 | B2 | C1...",
                  "meaning": "Vietnamese translation",
                  "englishMeaning": "Cambridge English definition",
                  "example": "Contextual example sentence",
                  "context": "Topic"
                }
              ]
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
                    new { role = "user", content = $"Extract vocabulary list from:\n\n{truncated}" }
                }
            };

            httpRequest.Content = JsonContent.Create(requestBody);
            var httpResponse = await _httpClient.SendAsync(httpRequest);

            if (!httpResponse.IsSuccessStatusCode) return new List<ScannedWordDto>();

            var responseJson = await httpResponse.Content.ReadFromJsonAsync<JsonElement>();
            var contentString = responseJson.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

            if (string.IsNullOrEmpty(contentString)) return new List<ScannedWordDto>();

            using var doc = JsonDocument.Parse(contentString);
            if (doc.RootElement.TryGetProperty("words", out var wordsArr) && wordsArr.ValueKind == JsonValueKind.Array)
            {
                return JsonSerializer.Deserialize<List<ScannedWordDto>>(wordsArr.GetRawText(), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<ScannedWordDto>();
            }

            return new List<ScannedWordDto>();
        }

        private List<ScannedWordDto> FallbackHeuristicExtractor(string text)
        {
            var results = new List<ScannedWordDto>();
            var lines = text.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var line in lines)
            {
                var clean = line.Trim();
                if (clean.Length > 2 && clean.Length < 35 && !clean.Contains("http") && !clean.Contains("www.") && char.IsLetter(clean[0]))
                {
                    results.Add(new ScannedWordDto
                    {
                        Word = clean,
                        Meaning = "Nghĩa đang được cập nhật",
                        EnglishMeaning = $"Definition for {clean}",
                        IsSelected = true
                    });
                }
            }

            return results.DistinctBy(w => w.Word.ToLowerInvariant()).Take(30).ToList();
        }
    }
}
