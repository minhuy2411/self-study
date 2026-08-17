using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

namespace AiRiser.Infrastructure.Services
{
    public class DictionaryDefinitionItem
    {
        public string Definition { get; set; } = string.Empty;
        public string? Example { get; set; }
        public List<string> Synonyms { get; set; } = new();
        public List<string> Antonyms { get; set; } = new();
    }

    public class DictionaryMeaningItem
    {
        public string PartOfSpeech { get; set; } = string.Empty;
        public List<DictionaryDefinitionItem> Definitions { get; set; } = new();
        public List<string> Synonyms { get; set; } = new();
    }

    public class ExternalDictionaryEntry
    {
        public string Word { get; set; } = string.Empty;
        public string? Phonetic { get; set; }
        public List<DictionaryMeaningItem> Meanings { get; set; } = new();
    }

    public class ExternalDictionaryService
    {
        private readonly HttpClient _httpClient;

        public ExternalDictionaryService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<object?> FetchWordDefinitionAsync(string word)
        {
            try
            {
                var response = await _httpClient.GetAsync($"https://api.dictionaryapi.dev/api/v2/entries/en/{Uri.EscapeDataString(word)}");
                if (!response.IsSuccessStatusCode) return null;

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                return doc.RootElement.Clone();
            }
            catch
            {
                return null;
            }
        }

        public async Task<List<ExternalDictionaryEntry>> GetDefinitionAsync(string word)
        {
            try
            {
                var response = await _httpClient.GetAsync($"https://api.dictionaryapi.dev/api/v2/entries/en/{Uri.EscapeDataString(word)}");
                if (!response.IsSuccessStatusCode) return new List<ExternalDictionaryEntry>();

                var json = await response.Content.ReadAsStringAsync();
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var entries = JsonSerializer.Deserialize<List<ExternalDictionaryEntry>>(json, options);
                return entries ?? new List<ExternalDictionaryEntry>();
            }
            catch
            {
                return new List<ExternalDictionaryEntry>();
            }
        }
    }
}
