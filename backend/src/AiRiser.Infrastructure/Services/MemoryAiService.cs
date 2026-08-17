using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using AiRiser.Core.Entities;
using AiRiser.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AiRiser.Infrastructure.Services
{
    public interface IMemoryAiService
    {
        Task<MemoryDashboardDto> GetDashboardStatsAsync(Guid userId);
        Task<List<WordMemoryStatusDto>> GetDueWordsAsync(Guid userId);
        Task<List<WordMemoryStatusDto>> GetWeakWordsAsync(Guid userId);
        Task<AiMemorySuggestionDto> GenerateAiMemorySuggestionsAsync(Guid userId);
    }

    public class MemoryAiService : IMemoryAiService
    {
        private readonly AppDbContext _context;
        private readonly ISrsEngineService _srsEngine;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<MemoryAiService> _logger;
        private readonly string _baseUrl;
        private readonly string? _apiKey;
        private readonly string _completionModel;

        public MemoryAiService(
            AppDbContext context,
            ISrsEngineService srsEngine,
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<MemoryAiService> logger)
        {
            _context = context;
            _srsEngine = srsEngine;
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _baseUrl = (configuration["AiSettings:BaseUrl"] ?? "https://api.openai.com/v1").TrimEnd('/');
            _apiKey = configuration["AiSettings:ApiKey"] ?? configuration["AiSettings:OpenAiApiKey"];
            _completionModel = configuration["AiSettings:CompletionModel"] ?? "openai/gpt-4o-mini";
        }

        public async Task<MemoryDashboardDto> GetDashboardStatsAsync(Guid userId)
        {
            var now = DateTime.UtcNow;
            var vocabs = await _context.Vocabularies
                .Include(v => v.WordMemory)
                .Where(v => v.UserId == userId)
                .ToListAsync();

            var totalWords = vocabs.Count;
            var wordStatuses = new List<WordMemoryStatusDto>();

            int masteredCount = 0;
            int retainingCount = 0;
            int learningCount = 0;
            int strugglingCount = 0;
            double totalRetention = 0;

            foreach (var v in vocabs)
            {
                var mem = v.WordMemory;
                double retention = 1.0;
                string status = "Learning";
                bool isDue = false;

                if (mem != null)
                {
                    retention = _srsEngine.CalculateRetentionScore(mem);
                    status = _srsEngine.DetermineRetentionStatus(mem, retention);
                    isDue = mem.NextReviewDate <= now.AddHours(2);
                }
                else
                {
                    isDue = true;
                }

                totalRetention += retention;

                switch (status)
                {
                    case "Mastered": masteredCount++; break;
                    case "Retaining": retainingCount++; break;
                    case "Struggling": strugglingCount++; break;
                    default: learningCount++; break;
                }

                wordStatuses.Add(new WordMemoryStatusDto
                {
                    WordId = v.Id,
                    Word = v.Word,
                    Meaning = v.Meaning,
                    Phonetic = v.Phonetic,
                    PartOfSpeech = v.PartOfSpeech,
                    Example = v.Example,
                    RepetitionCount = mem?.RepetitionCount ?? 0,
                    ErrorCount = mem?.ErrorCount ?? 0,
                    Interval = mem?.Interval ?? 0,
                    EaseFactor = mem?.EaseFactor ?? 2.5,
                    NextReviewDate = mem?.NextReviewDate ?? now,
                    LastTestedAt = mem?.LastTestedAt,
                    RetentionScore = retention,
                    RetentionStatus = status,
                    IsDueForReview = isDue
                });
            }

            var overallRetention = totalWords > 0 ? Math.Round((totalRetention / totalWords) * 100, 1) : 0.0;
            var streak = await _srsEngine.CalculateUserStreakAsync(userId);

            // Recent 7 days activity
            var sevenDaysAgo = now.Date.AddDays(-6);
            var logs = await _context.WordReviewLogs
                .Where(rl => rl.UserId == userId && rl.ReviewedAt >= sevenDaysAgo)
                .ToListAsync();

            var recentActivity = new List<DailyReviewActivityDto>();
            for (int i = 6; i >= 0; i--)
            {
                var targetDate = now.Date.AddDays(-i);
                var dayLogs = logs.Where(l => l.ReviewedAt.Date == targetDate).ToList();
                var dayName = targetDate.DayOfWeek switch
                {
                    DayOfWeek.Monday => "T2",
                    DayOfWeek.Tuesday => "T3",
                    DayOfWeek.Wednesday => "T4",
                    DayOfWeek.Thursday => "T5",
                    DayOfWeek.Friday => "T6",
                    DayOfWeek.Saturday => "T7",
                    _ => "CN"
                };

                recentActivity.Add(new DailyReviewActivityDto
                {
                    DateString = targetDate.ToString("yyyy-MM-dd"),
                    DayOfWeek = dayName,
                    ReviewCount = dayLogs.Count,
                    CorrectCount = dayLogs.Count(l => l.WasCorrect)
                });
            }

            var dueWords = wordStatuses.Where(w => w.IsDueForReview).OrderBy(w => w.NextReviewDate).ToList();
            var weakWords = wordStatuses.Where(w => w.ErrorCount > 0 || w.RetentionStatus == "Struggling")
                                        .OrderByDescending(w => w.ErrorCount)
                                        .ThenBy(w => w.RetentionScore)
                                        .ToList();

            return new MemoryDashboardDto
            {
                TotalWords = totalWords,
                DueTodayCount = dueWords.Count,
                MasteredCount = masteredCount,
                WeakWordsCount = weakWords.Count,
                CurrentStreakDays = streak,
                OverallRetentionRate = overallRetention,
                RetentionTiers = new RetentionTiersDto
                {
                    Mastered = masteredCount,
                    Retaining = retainingCount,
                    Learning = learningCount,
                    Struggling = strugglingCount
                },
                RecentActivity = recentActivity,
                DueWords = dueWords,
                WeakWords = weakWords
            };
        }

        public async Task<List<WordMemoryStatusDto>> GetDueWordsAsync(Guid userId)
        {
            var stats = await GetDashboardStatsAsync(userId);
            return stats.DueWords;
        }

        public async Task<List<WordMemoryStatusDto>> GetWeakWordsAsync(Guid userId)
        {
            var stats = await GetDashboardStatsAsync(userId);
            return stats.WeakWords;
        }

        public async Task<AiMemorySuggestionDto> GenerateAiMemorySuggestionsAsync(Guid userId)
        {
            var stats = await GetDashboardStatsAsync(userId);

            // If API key is provided, call LLM with JSON format
            if (!string.IsNullOrEmpty(_apiKey) && !_apiKey.StartsWith("YOUR_") && _apiKey.Length > 5)
            {
                try
                {
                    var aiSuggestion = await CallLlmForMemoryCoachAsync(stats);
                    if (aiSuggestion != null) return aiSuggestion;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to call LLM for Memory AI Coach. Falling back to rule-based engine.");
                }
            }

            return GenerateFallbackMemorySuggestions(stats);
        }

        private async Task<AiMemorySuggestionDto?> CallLlmForMemoryCoachAsync(MemoryDashboardDto stats)
        {
            var systemPrompt = """
            You are a specialized AI Memory & Cognitive Science Coach in the AI-Riser application.
            Based on the student's Spaced Repetition (SRS) data, forgetting curve, and weak words, generate actionable, encouraging advice in Vietnamese.

            Output strictly valid JSON matching this schema:
            {
              "overallAssessment": "2-3 sentences evaluating overall memory stability and progress",
              "dailyActionPlan": "A clear bulleted or step-by-step daily study recommendation for today",
              "retentionForecast": "Scientific forecast of retention over the next 7-14 days based on Ebbinghaus forgetting curve",
              "highPriorityWords": [
                {
                  "wordId": "<guid>",
                  "word": "<word>",
                  "meaning": "<meaning>",
                  "errorCount": number,
                  "mnemonicTip": "Creative mnemonic, association trick, or visual hook in Vietnamese",
                  "exampleSentence": "A memorable contextual sentence"
                }
              ],
              "motivationalQuote": "An inspiring quote about consistency and learning"
            }
            """;

            var userPayload = new
            {
                totalWords = stats.TotalWords,
                dueToday = stats.DueTodayCount,
                mastered = stats.MasteredCount,
                weakCount = stats.WeakWordsCount,
                streak = stats.CurrentStreakDays,
                overallRetentionRate = stats.OverallRetentionRate,
                retentionTiers = stats.RetentionTiers,
                weakWordsSample = stats.WeakWords.Take(5).Select(w => new
                {
                    wordId = w.WordId.ToString(),
                    word = w.Word,
                    meaning = w.Meaning,
                    errorCount = w.ErrorCount,
                    retention = w.RetentionScore
                })
            };

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/chat/completions");
            httpRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
            httpRequest.Headers.Add("x-api-key", _apiKey);

            var requestBody = new
            {
                model = _completionModel,
                response_format = new { type = "json_object" },
                temperature = 0.5,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = JsonSerializer.Serialize(userPayload) }
                }
            };

            httpRequest.Content = JsonContent.Create(requestBody);
            var httpResponse = await _httpClient.SendAsync(httpRequest);

            if (!httpResponse.IsSuccessStatusCode) return null;

            var responseJson = await httpResponse.Content.ReadFromJsonAsync<JsonElement>();
            var contentString = responseJson.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

            if (string.IsNullOrEmpty(contentString)) return null;

            return JsonSerializer.Deserialize<AiMemorySuggestionDto>(contentString, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }

        private AiMemorySuggestionDto GenerateFallbackMemorySuggestions(MemoryDashboardDto stats)
        {
            var result = new AiMemorySuggestionDto();

            if (stats.DueTodayCount > 0)
            {
                result.OverallAssessment = $"Hôm nay bạn có {stats.DueTodayCount} từ vựng đang đến ngưỡng đường cong quên (Ebbinghaus Forgetting Threshold). Việc ôn tập ngay lúc này sẽ giúp tăng gấp 3 lần độ bền trí nhớ.";
                result.DailyActionPlan = $"1. Hoàn thành {stats.DueTodayCount} thẻ Flashcard cần ôn tập hôm nay.\n2. Luyện 1 bài Quiz (Chế độ Ôn tập từ hay sai) để củng cố các từ yếu.\n3. Duy trì chuỗi streak {stats.CurrentStreakDays} ngày!";
            }
            else
            {
                result.OverallAssessment = $"Tuyệt vời! Bạn không còn từ nào bị trễ hạn ôn tập. Độ bền trí nhớ trung bình của bạn đang đạt {stats.OverallRetentionRate}%.";
                result.DailyActionPlan = "1. Bạn có thể thêm 3-5 từ vựng mới vào kho từ vựng.\n2. Thử sức với 1 bài Quiz tiếng Anh ➔ Việt tổng hợp để kiểm tra phản xạ.";
            }

            result.RetentionForecast = $"Dự báo nếu duy trì nhịp ôn tập ngắt quãng này, tỉ lệ nhớ dài hạn (Long-term Retention) sẽ đạt trên {Math.Min(95.0, stats.OverallRetentionRate + 5)}% sau 14 ngày.";
            result.MotivationalQuote = "“Repetition is the mother of learning, the father of action, which makes it the architect of accomplishment.”";

            foreach (var w in stats.WeakWords.Take(3))
            {
                result.HighPriorityWords.Add(new WeakWordTipDto
                {
                    WordId = w.WordId,
                    Word = w.Word,
                    Meaning = w.Meaning,
                    ErrorCount = w.ErrorCount,
                    MnemonicTip = $"Hãy liên tưởng từ '{w.Word}' với một câu chuyện cá nhân hoặc hình ảnh hài hước.",
                    ExampleSentence = w.Example ?? $"I am mastering the word {w.Word} day by day."
                });
            }

            return result;
        }
    }
}
