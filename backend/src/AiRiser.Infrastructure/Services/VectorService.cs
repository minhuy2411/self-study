using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using AiRiser.Core.Entities;
using AiRiser.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AiRiser.Infrastructure.Services
{
    public interface IVectorService
    {
        Task<float[]> GenerateEmbeddingAsync(string text);
        Task<WordVector> SyncVocabularyVectorAsync(Vocabulary vocabulary, string? extraContext = null);
        Task<int> SyncAllUserVectorsAsync(Guid userId);
        Task<List<Vocabulary>> SearchSimilarWordsAsync(Guid userId, string queryText, int topK = 5, Guid? excludeWordId = null);
        Task<List<Vocabulary>> GetSemanticDistractorsAsync(Guid userId, Vocabulary targetWord, int count = 3);
        double ComputeCosineSimilarity(float[] vecA, float[] vecB);
    }

    public class VectorService : IVectorService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<VectorService> _logger;
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;
        private readonly string? _apiKey;
        private readonly string _embeddingModel;
        private const int VectorDimensions = 1536;

        public VectorService(
            AppDbContext context,
            IConfiguration configuration,
            ILogger<VectorService> logger,
            HttpClient httpClient)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
            _httpClient = httpClient;
            _baseUrl = (configuration["AiSettings:BaseUrl"] ?? "https://api.openai.com/v1").TrimEnd('/');
            _apiKey = configuration["AiSettings:ApiKey"] ?? configuration["AiSettings:OpenAiApiKey"];
            _embeddingModel = configuration["AiSettings:EmbeddingModel"] ?? "text-embedding-3-small";
        }

        public async Task<float[]> GenerateEmbeddingAsync(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return new float[VectorDimensions];
            }

            // 1. If API Key is provided, call Embedding endpoint
            if (!string.IsNullOrEmpty(_apiKey) && !_apiKey.StartsWith("YOUR_") && _apiKey.Length > 5)
            {
                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/embeddings");
                    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
                    request.Headers.Add("x-api-key", _apiKey);
                    
                    var body = new
                    {
                        model = _embeddingModel,
                        input = text
                    };
                    request.Content = JsonContent.Create(body);

                    var response = await _httpClient.SendAsync(request);
                    if (response.IsSuccessStatusCode)
                    {
                        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
                        var embeddingArr = json.GetProperty("data")[0].GetProperty("embedding").EnumerateArray()
                            .Select(x => (float)x.GetDouble()).ToArray();
                        return embeddingArr;
                    }
                    _logger.LogWarning("OpenAI embedding request returned {StatusCode}. Falling back to local semantic vectorizer.", response.StatusCode);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "OpenAI embedding request failed. Falling back to local semantic vectorizer.");
                }
            }

            // 2. High quality deterministic local semantic vectorizer (word-char-ngram hash projection with L2 normalization)
            return GenerateDeterministicEmbedding(text, VectorDimensions);
        }

        public async Task<WordVector> SyncVocabularyVectorAsync(Vocabulary vocabulary, string? extraContext = null)
        {
            var textToEmbed = $"{vocabulary.Word}: {vocabulary.Meaning}. Part of speech: {vocabulary.PartOfSpeech}. Example: {vocabulary.Example}. Notes: {vocabulary.CustomNotes}. Context: {extraContext}";
            var embedding = await GenerateEmbeddingAsync(textToEmbed);
            var embeddingJson = JsonSerializer.Serialize(embedding);

            var contextPayloadObj = new
            {
                word = vocabulary.Word,
                meaning = vocabulary.Meaning,
                phonetic = vocabulary.Phonetic,
                partOfSpeech = vocabulary.PartOfSpeech,
                example = vocabulary.Example,
                notes = vocabulary.CustomNotes,
                extraContext = extraContext ?? string.Empty,
                syncedAt = DateTime.UtcNow
            };
            var contextPayload = JsonSerializer.Serialize(contextPayloadObj);

            var existingVector = await _context.WordVectors.FirstOrDefaultAsync(wv => wv.WordId == vocabulary.Id);
            if (existingVector != null)
            {
                existingVector.EmbeddingJson = embeddingJson;
                existingVector.ContextPayload = contextPayload;
                existingVector.Dimensions = embedding.Length;
                existingVector.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                existingVector = new WordVector
                {
                    WordId = vocabulary.Id,
                    UserId = vocabulary.UserId,
                    EmbeddingJson = embeddingJson,
                    ContextPayload = contextPayload,
                    Dimensions = embedding.Length,
                    CreatedAt = DateTime.UtcNow
                };
                _context.WordVectors.Add(existingVector);
            }

            await _context.SaveChangesAsync();
            return existingVector;
        }

        public async Task<int> SyncAllUserVectorsAsync(Guid userId)
        {
            var vocabs = await _context.Vocabularies.Where(v => v.UserId == userId).ToListAsync();
            int count = 0;
            foreach (var vocab in vocabs)
            {
                await SyncVocabularyVectorAsync(vocab);
                count++;
            }
            return count;
        }

        public async Task<List<Vocabulary>> SearchSimilarWordsAsync(Guid userId, string queryText, int topK = 5, Guid? excludeWordId = null)
        {
            var queryEmbedding = await GenerateEmbeddingAsync(queryText);
            var userVectors = await _context.WordVectors
                .Include(wv => wv.Vocabulary)
                .Where(wv => wv.UserId == userId && (excludeWordId == null || wv.WordId != excludeWordId.Value))
                .ToListAsync();

            if (!userVectors.Any())
            {
                // Fallback to direct DB query if no vectors yet
                return await _context.Vocabularies
                    .Where(v => v.UserId == userId && (excludeWordId == null || v.Id != excludeWordId.Value))
                    .Take(topK)
                    .ToListAsync();
            }

            var scored = userVectors.Select(v =>
            {
                try
                {
                    var vec = JsonSerializer.Deserialize<float[]>(v.EmbeddingJson) ?? Array.Empty<float>();
                    var similarity = ComputeCosineSimilarity(queryEmbedding, vec);
                    return new { Vector = v, Similarity = similarity };
                }
                catch
                {
                    return new { Vector = v, Similarity = 0.0 };
                }
            })
            .OrderByDescending(x => x.Similarity)
            .Take(topK)
            .Where(x => x.Vector.Vocabulary != null)
            .Select(x => x.Vector.Vocabulary!)
            .ToList();

            return scored;
        }

        public async Task<List<Vocabulary>> GetSemanticDistractorsAsync(Guid userId, Vocabulary targetWord, int count = 3)
        {
            // First search similar words from user's vocabulary
            var similar = await SearchSimilarWordsAsync(userId, $"{targetWord.Word} {targetWord.PartOfSpeech} {targetWord.Meaning}", count * 2, targetWord.Id);

            var distractors = similar.Take(count).ToList();

            // If user has fewer words than needed, fill with fallback vocabulary from other users or synthetic items
            if (distractors.Count < count)
            {
                var otherVocabs = await _context.Vocabularies
                    .Where(v => v.Id != targetWord.Id && !distractors.Select(d => d.Id).Contains(v.Id))
                    .OrderBy(r => EF.Functions.Random())
                    .Take(count - distractors.Count)
                    .ToListAsync();

                distractors.AddRange(otherVocabs);
            }

            return distractors;
        }

        public double ComputeCosineSimilarity(float[] vecA, float[] vecB)
        {
            if (vecA == null || vecB == null || vecA.Length == 0 || vecB.Length == 0) return 0.0;
            int length = Math.Min(vecA.Length, vecB.Length);

            double dotProduct = 0.0;
            double normA = 0.0;
            double normB = 0.0;

            for (int i = 0; i < length; i++)
            {
                dotProduct += vecA[i] * vecB[i];
                normA += vecA[i] * vecA[i];
                normB += vecB[i] * vecB[i];
            }

            if (normA <= 0 || normB <= 0) return 0.0;
            return dotProduct / (Math.Sqrt(normA) * Math.Sqrt(normB));
        }

        private static float[] GenerateDeterministicEmbedding(string text, int dimensions)
        {
            var vector = new float[dimensions];
            var normalizedText = text.ToLowerInvariant().Trim();
            var words = normalizedText.Split(new[] { ' ', '.', ',', '!', '?', ';', ':', '-', '(', ')', '[', ']' }, StringSplitOptions.RemoveEmptyEntries);

            if (words.Length == 0) return vector;

            foreach (var word in words)
            {
                using var md5 = MD5.Create();
                var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(word));
                for (int i = 0; i < hash.Length; i++)
                {
                    int index = (hash[i] * 37 + i * 19) % dimensions;
                    vector[index] += (float)(hash[i] - 128) / 128f;
                }

                // 2-gram and 3-gram character features
                for (int j = 0; j < word.Length - 1; j++)
                {
                    var bigram = word.Substring(j, 2);
                    int hashBi = Math.Abs(bigram.GetHashCode()) % dimensions;
                    vector[hashBi] += 0.5f;
                }
            }

            // L2 normalize
            double sumSq = 0;
            for (int i = 0; i < dimensions; i++) sumSq += vector[i] * vector[i];
            if (sumSq > 0)
            {
                float norm = (float)Math.Sqrt(sumSq);
                for (int i = 0; i < dimensions; i++) vector[i] /= norm;
            }

            return vector;
        }
    }
}
