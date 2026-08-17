using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using AiRiser.Core.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AiRiser.Infrastructure.Services
{
    public interface IAiService
    {
        Task<List<QuizQuestionDto>> GenerateQuizQuestionsAsync(
            List<RagContextDto> ragContexts,
            QuizType? targetType,
            QuizDifficulty difficulty,
            Dictionary<Guid, List<string>>? distractorsMap = null);

        Task<EvaluationResultDto> EvaluateAnswerAsync(
            SubmitAnswerRequest request,
            RagContextDto? ragContext = null);
    }

    public class AiService : IAiService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AiService> _logger;
        private readonly string _baseUrl;
        private readonly string? _apiKey;
        private readonly string _completionModel;

        public AiService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<AiService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _baseUrl = (configuration["AiSettings:BaseUrl"] ?? "https://api.openai.com/v1").TrimEnd('/');
            _apiKey = configuration["AiSettings:ApiKey"] ?? configuration["AiSettings:OpenAiApiKey"];
            _completionModel = configuration["AiSettings:CompletionModel"] ?? "openai/gpt-4o-mini";
        }

        public async Task<List<QuizQuestionDto>> GenerateQuizQuestionsAsync(
            List<RagContextDto> ragContexts,
            QuizType? targetType,
            QuizDifficulty difficulty,
            Dictionary<Guid, List<string>>? distractorsMap = null)
        {
            if (ragContexts == null || ragContexts.Count == 0)
                return new List<QuizQuestionDto>();

            // Try LLM generation if API Key is configured
            if (!string.IsNullOrEmpty(_apiKey) && !_apiKey.StartsWith("YOUR_") && _apiKey.Length > 5)
            {
                try
                {
                    var questions = await CallLlmForQuizGenerationAsync(ragContexts, targetType, difficulty, distractorsMap);
                    if (questions != null && questions.Count > 0)
                    {
                        return questions;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "OpenAI Quiz Generation failed. Falling back to local RAG generator.");
                }
            }

            // Local RAG Generator fallback (Instant, offline, zero error)
            return GenerateFallbackQuizQuestions(ragContexts, targetType, difficulty, distractorsMap);
        }

        public async Task<EvaluationResultDto> EvaluateAnswerAsync(
            SubmitAnswerRequest request,
            RagContextDto? ragContext = null)
        {
            // For multiple choice, simple exact match or option match
            if (request.Type == QuizType.MultipleChoiceWordToMeaning || request.Type == QuizType.MultipleChoiceMeaningToWord)
            {
                var isCleanMatch = string.Equals(request.UserAnswer.Trim(), request.CorrectAnswer.Trim(), StringComparison.OrdinalIgnoreCase);
                return new EvaluationResultDto
                {
                    IsCorrect = isCleanMatch,
                    Score = isCleanMatch ? 100 : 0,
                    UserAnswer = request.UserAnswer,
                    CorrectAnswer = request.CorrectAnswer,
                    Feedback = isCleanMatch ? "Chính xác tuyệt vời! 🎉" : "Chưa chính xác.",
                    DetailedExplanation = isCleanMatch 
                        ? $"Đáp án chính xác là '{request.CorrectAnswer}'. Bạn đã chọn đúng nghĩa/từ cần nhớ."
                        : $"Đáp án đúng phải là '{request.CorrectAnswer}'. Hãy ghi nhớ từ vựng này nhé.",
                    GrammarBreakdown = ragContext != null && !string.IsNullOrEmpty(ragContext.PartOfSpeech)
                        ? $"Từ loại: {ragContext.PartOfSpeech} - Phiên âm: {ragContext.Phonetic ?? "N/A"}"
                        : "Từ vựng cơ bản",
                    UsageTip = "Luyện tập lặp lại ngắt quãng để ghi nhớ lâu hơn.",
                    ExampleSentence = ragContext?.Example ?? request.SentenceContext ?? string.Empty
                };
            }

            // For translation and fill-in-the-blank, call LLM with JSON output format if key is provided
            if (!string.IsNullOrEmpty(_apiKey) && !_apiKey.StartsWith("YOUR_") && _apiKey.Length > 5)
            {
                try
                {
                    var eval = await CallLlmForAnswerEvaluationAsync(request, ragContext);
                    if (eval != null)
                    {
                        return eval;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "LLM Evaluation failed. Falling back to semantic local evaluator.");
                }
            }

            return EvaluateLocally(request, ragContext);
        }

        private async Task<List<QuizQuestionDto>> CallLlmForQuizGenerationAsync(
            List<RagContextDto> ragContexts,
            QuizType? targetType,
            QuizDifficulty difficulty,
            Dictionary<Guid, List<string>>? distractorsMap)
        {
            var systemPrompt = """
            You are an expert English Language Professor & Quiz Designer for the AI-Riser application.
            Your task is to generate interactive quiz questions in JSON format based on the retrieved vocabulary context.

            You must strictly return a JSON object with a single property "questions" containing an array of question objects.
            Format for each question:
            {
              "wordId": "<guid>",
              "targetWord": "<word>",
              "targetPhonetic": "<phonetic>",
              "targetMeaning": "<meaning>",
              "type": 1|2|3|4|5,
              "questionPrompt": "<Question text>",
              "sentenceContext": "<Example/Context sentence with [___] cloze if type 3>",
              "options": ["Option A", "Option B", "Option C", "Option D"], // required for type 1 & 2, empty for type 3, 4, 5
              "correctAnswer": "<correct answer string>",
              "explanationHint": "<short hint or grammar note>",
              "ragSourceContext": "<retrieved context snippet>"
            }

            Quiz Types:
            1: MultipleChoice (Word -> Vietnamese Meaning)
            2: MultipleChoice (Meaning -> English Word)
            3: Fill in the blank (A natural sentence with the target word replaced with [___])
            4: English to Vietnamese translation (Translate an English sentence containing the target word)
            5: Vietnamese to English translation (Translate a Vietnamese sentence into English using the target word)
            """;

            var userPayload = new
            {
                requestedType = targetType.HasValue ? (int)targetType.Value : (int?)null,
                difficulty = difficulty.ToString(),
                items = ragContexts.Select(r => new
                {
                    wordId = r.WordId.ToString(),
                    word = r.Word,
                    meaning = r.Meaning,
                    phonetic = r.Phonetic,
                    partOfSpeech = r.PartOfSpeech,
                    example = r.Example,
                    synonyms = r.Synonyms,
                    retrievedContext = r.FormattedPromptContext
                })
            };

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/chat/completions");
            httpRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
            httpRequest.Headers.Add("x-api-key", _apiKey);

            var requestBody = new
            {
                model = _completionModel,
                response_format = new { type = "json_object" },
                temperature = 0.6,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = JsonSerializer.Serialize(userPayload) }
                }
            };

            httpRequest.Content = JsonContent.Create(requestBody);
            var httpResponse = await _httpClient.SendAsync(httpRequest);

            if (!httpResponse.IsSuccessStatusCode)
            {
                var errContent = await httpResponse.Content.ReadAsStringAsync();
                _logger.LogWarning("OpenAI API returned error {StatusCode}: {Error}", httpResponse.StatusCode, errContent);
                return new List<QuizQuestionDto>();
            }

            var responseJson = await httpResponse.Content.ReadFromJsonAsync<JsonElement>();
            var contentString = responseJson.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

            if (string.IsNullOrEmpty(contentString))
                return new List<QuizQuestionDto>();

            var parsedQuestions = ParseQuestionsFromJson(contentString);
            return parsedQuestions;
        }

        private async Task<EvaluationResultDto?> CallLlmForAnswerEvaluationAsync(
            SubmitAnswerRequest request,
            RagContextDto? ragContext)
        {
            var systemPrompt = """
            You are an intelligent bilingual English-Vietnamese AI Tutor evaluating a student's answer in the AI-Riser system.
            You must output strictly valid JSON matching this schema:
            {
              "isCorrect": boolean,
              "score": number (0-100),
              "feedback": "Concise Vietnamese assessment (e.g., Tuyệt vời, Rất tốt, Gần chính xác, Chưa chính xác)",
              "detailedExplanation": "Detailed explanation in Vietnamese of why this answer is correct or incorrect, semantic nuances, and natural alternative phrasings",
              "grammarBreakdown": "Grammar rules, sentence structure analysis, or part-of-speech explanations",
              "usageTip": "Practical memory tip or common collocation in Vietnamese",
              "exampleSentence": "A natural example sentence illustrating the usage"
            }
            """;

            var userPrompt = $"""
            [TASK EVALUATION]
            Quiz Type: {request.Type}
            Question Prompt: {request.QuestionPrompt}
            Sentence Context: {request.SentenceContext ?? "N/A"}
            Expected Correct Answer: {request.CorrectAnswer}
            Student's Answer: {request.UserAnswer}
            Word Context: {ragContext?.Word ?? ""} ({ragContext?.PartOfSpeech ?? ""}) - Meaning: {ragContext?.Meaning ?? ""}
            
            Evaluate the student's submission fairly, accounting for acceptable synonyms, minor typos, and natural phrasing.
            """;

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/chat/completions");
            httpRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
            httpRequest.Headers.Add("x-api-key", _apiKey);

            var requestBody = new
            {
                model = _completionModel,
                response_format = new { type = "json_object" },
                temperature = 0.3,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                }
            };

            httpRequest.Content = JsonContent.Create(requestBody);
            var httpResponse = await _httpClient.SendAsync(httpRequest);

            if (!httpResponse.IsSuccessStatusCode)
            {
                return null;
            }

            var responseJson = await httpResponse.Content.ReadFromJsonAsync<JsonElement>();
            var contentString = responseJson.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

            if (string.IsNullOrEmpty(contentString))
                return null;

            var result = JsonSerializer.Deserialize<EvaluationResultDto>(contentString, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (result != null)
            {
                result.UserAnswer = request.UserAnswer;
                result.CorrectAnswer = request.CorrectAnswer;
            }
            return result;
        }

        private List<QuizQuestionDto> ParseQuestionsFromJson(string jsonString)
        {
            var list = new List<QuizQuestionDto>();
            try
            {
                using var doc = JsonDocument.Parse(jsonString);
                var root = doc.RootElement;
                JsonElement questionsArr;

                if (root.TryGetProperty("questions", out questionsArr) && questionsArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var elem in questionsArr.EnumerateArray())
                    {
                        var q = new QuizQuestionDto
                        {
                            Id = Guid.NewGuid(),
                            WordId = elem.TryGetProperty("wordId", out var wId) && Guid.TryParse(wId.GetString(), out var gId) ? gId : Guid.NewGuid(),
                            TargetWord = elem.TryGetProperty("targetWord", out var tw) ? tw.GetString() ?? "" : "",
                            TargetPhonetic = elem.TryGetProperty("targetPhonetic", out var tp) ? tp.GetString() ?? "" : "",
                            TargetMeaning = elem.TryGetProperty("targetMeaning", out var tm) ? tm.GetString() ?? "" : "",
                            Type = elem.TryGetProperty("type", out var ty) && ty.TryGetInt32(out var tInt) ? (QuizType)tInt : QuizType.MultipleChoiceWordToMeaning,
                            QuestionPrompt = elem.TryGetProperty("questionPrompt", out var qp) ? qp.GetString() ?? "" : "",
                            SentenceContext = elem.TryGetProperty("sentenceContext", out var sc) ? sc.GetString() : null,
                            CorrectAnswer = elem.TryGetProperty("correctAnswer", out var ca) ? ca.GetString() ?? "" : "",
                            ExplanationHint = elem.TryGetProperty("explanationHint", out var eh) ? eh.GetString() : null,
                            RagSourceContext = elem.TryGetProperty("ragSourceContext", out var rc) ? rc.GetString() : null
                        };

                        if (elem.TryGetProperty("options", out var opts) && opts.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var opt in opts.EnumerateArray())
                            {
                                var optStr = opt.GetString();
                                if (!string.IsNullOrEmpty(optStr)) q.Options.Add(optStr);
                            }
                        }

                        list.Add(q);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse JSON response from LLM: {Json}", jsonString);
            }
            return list;
        }

        private List<QuizQuestionDto> GenerateFallbackQuizQuestions(
            List<RagContextDto> ragContexts,
            QuizType? targetType,
            QuizDifficulty difficulty,
            Dictionary<Guid, List<string>>? distractorsMap)
        {
            var result = new List<QuizQuestionDto>();
            var random = new Random();

            for (int i = 0; i < ragContexts.Count; i++)
            {
                var r = ragContexts[i];
                // Determine format
                QuizType typeToUse;
                if (targetType.HasValue)
                {
                    typeToUse = targetType.Value;
                }
                else
                {
                    // Rotate among the 4 main formats
                    var formats = new[]
                    {
                        QuizType.MultipleChoiceWordToMeaning,
                        QuizType.MultipleChoiceMeaningToWord,
                        QuizType.FillInTheBlank,
                        QuizType.EnglishToVietnamese,
                        QuizType.VietnameseToEnglish
                    };
                    typeToUse = formats[i % formats.Length];
                }

                var q = new QuizQuestionDto
                {
                    Id = Guid.NewGuid(),
                    WordId = r.WordId,
                    TargetWord = r.Word,
                    TargetPhonetic = r.Phonetic ?? "",
                    TargetMeaning = r.Meaning,
                    Type = typeToUse,
                    RagSourceContext = r.FormattedPromptContext
                };

                switch (typeToUse)
                {
                    case QuizType.MultipleChoiceWordToMeaning:
                        q.QuestionPrompt = $"Nghĩa của từ \"{r.Word}\" là gì?";
                        q.CorrectAnswer = r.Meaning;
                        q.SentenceContext = r.RelatedSentences.FirstOrDefault() ?? r.Example;
                        q.ExplanationHint = $"Từ loại: {r.PartOfSpeech ?? "từ vựng"} | Phiên âm: {r.Phonetic ?? ""}";
                        
                        // Populate options with correct answer + distractors
                        var opts1 = new List<string> { r.Meaning };
                        if (distractorsMap != null && distractorsMap.TryGetValue(r.WordId, out var dists1))
                        {
                            opts1.AddRange(dists1.Take(3));
                        }
                        while (opts1.Count < 4)
                        {
                            var generic = GetGenericDistractorMeaning(opts1.Count);
                            if (!opts1.Contains(generic)) opts1.Add(generic);
                            else opts1.Add($"{generic} ({opts1.Count})");
                        }
                        q.Options = opts1.OrderBy(_ => random.Next()).ToList();
                        break;

                    case QuizType.MultipleChoiceMeaningToWord:
                        q.QuestionPrompt = $"Từ tiếng Anh nào mang nghĩa: \"{r.Meaning}\"?";
                        q.CorrectAnswer = r.Word;
                        q.SentenceContext = r.RelatedSentences.FirstOrDefault() ?? r.Example;
                        q.ExplanationHint = $"Gợi ý: Phiên âm {r.Phonetic ?? ""}";

                        var opts2 = new List<string> { r.Word };
                        if (distractorsMap != null && distractorsMap.TryGetValue(r.WordId, out var dists2))
                        {
                            opts2.AddRange(dists2.Take(3));
                        }
                        while (opts2.Count < 4)
                        {
                            var generic = GetGenericDistractorWord(opts2.Count);
                            if (!opts2.Contains(generic)) opts2.Add(generic);
                            else opts2.Add($"{generic}_{opts2.Count}");
                        }
                        q.Options = opts2.OrderBy(_ => random.Next()).ToList();
                        break;

                    case QuizType.FillInTheBlank:
                        var rawSentence = r.RelatedSentences.FirstOrDefault() ?? r.Example ?? $"I always remember the word {r.Word} clearly.";
                        // Replace the target word with [___] (case insensitive)
                        var pattern = $@"\b{Regex.Escape(r.Word)}\b";
                        var clozeSentence = Regex.Replace(rawSentence, pattern, "[___]", RegexOptions.IgnoreCase);
                        if (!clozeSentence.Contains("[___]"))
                        {
                            clozeSentence = rawSentence.Replace(r.Word, "[___]");
                        }

                        q.QuestionPrompt = "Điền từ thích hợp vào chỗ trống trong câu sau:";
                        q.SentenceContext = clozeSentence;
                        q.CorrectAnswer = r.Word;
                        q.ExplanationHint = $"Nghĩa của từ: {r.Meaning} ({r.PartOfSpeech ?? ""})";
                        break;

                    case QuizType.EnglishToVietnamese:
                        var enSentence = r.RelatedSentences.FirstOrDefault() ?? r.Example ?? $"The concept of {r.Word} is very interesting.";
                        q.QuestionPrompt = "Dịch câu tiếng Anh sau sang tiếng Việt:";
                        q.SentenceContext = enSentence;
                        q.CorrectAnswer = $"Câu chứa từ \"{r.Word}\" ({r.Meaning})";
                        q.ExplanationHint = $"Từ khóa: {r.Word} = {r.Meaning}";
                        break;

                    case QuizType.VietnameseToEnglish:
                        q.QuestionPrompt = $"Viết câu tiếng Anh hoặc cụm từ sử dụng từ \"{r.Word}\" để diễn đạt nghĩa: \"{r.Meaning}\"";
                        q.SentenceContext = $"Gợi ý ngữ cảnh: {r.Example ?? r.Meaning}";
                        q.CorrectAnswer = r.Word;
                        q.ExplanationHint = $"Từ cần sử dụng: {r.Word} ({r.Phonetic ?? ""})";
                        break;
                }

                result.Add(q);
            }

            return result;
        }

        private EvaluationResultDto EvaluateLocally(SubmitAnswerRequest request, RagContextDto? ragContext)
        {
            var user = request.UserAnswer.Trim().ToLowerInvariant();
            var target = request.CorrectAnswer.Trim().ToLowerInvariant();
            var targetWord = ragContext?.Word?.ToLowerInvariant() ?? "";

            bool isMatch = false;
            int score = 0;

            if (request.Type == QuizType.FillInTheBlank || request.Type == QuizType.VietnameseToEnglish)
            {
                if (user == target || (!string.IsNullOrEmpty(targetWord) && user == targetWord))
                {
                    isMatch = true;
                    score = 100;
                }
                else if (!string.IsNullOrEmpty(targetWord) && user.Contains(targetWord))
                {
                    isMatch = true;
                    score = 90;
                }
                else
                {
                    // Check Levenshtein distance for close typos
                    var dist = ComputeLevenshteinDistance(user, target);
                    if (dist <= 1 && target.Length >= 4)
                    {
                        isMatch = true;
                        score = 85;
                    }
                    else if (dist <= 2 && target.Length >= 6)
                    {
                        isMatch = true;
                        score = 70;
                    }
                }
            }
            else if (request.Type == QuizType.EnglishToVietnamese)
            {
                // Check if user answer contains keywords from meaning
                var meaningKeywords = (ragContext?.Meaning ?? request.CorrectAnswer)
                    .Split(new[] { ' ', ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(k => k.Trim().ToLowerInvariant())
                    .Where(k => k.Length > 2)
                    .ToList();

                int matchedKeywords = meaningKeywords.Count(k => user.Contains(k));
                if (matchedKeywords > 0 || user.Length > 5)
                {
                    score = Math.Min(100, 60 + matchedKeywords * 20);
                    isMatch = score >= 60;
                }
            }

            return new EvaluationResultDto
            {
                IsCorrect = isMatch,
                Score = score,
                UserAnswer = request.UserAnswer,
                CorrectAnswer = request.CorrectAnswer,
                Feedback = isMatch ? (score >= 90 ? "Xuất sắc! 🎉" : "Khá tốt! 👍") : "Cần cố gắng thêm.",
                DetailedExplanation = isMatch
                    ? $"Câu trả lời của bạn thể hiện đúng ngữ cảnh của từ '{ragContext?.Word ?? request.CorrectAnswer}'."
                    : $"Đáp án mong đợi liên quan đến: '{request.CorrectAnswer}'. Hãy chú ý ngữ cảnh và cấu trúc câu.",
                GrammarBreakdown = ragContext != null 
                    ? $"Từ loại: {ragContext.PartOfSpeech ?? "N/A"} | Phiên âm: {ragContext.Phonetic ?? "N/A"}" 
                    : "Cấu trúc từ vựng tiếng Anh",
                UsageTip = "Hãy đặt 1 câu thực tế trong cuộc sống với từ này để nhớ lâu hơn.",
                ExampleSentence = ragContext?.RelatedSentences?.FirstOrDefault() ?? ragContext?.Example ?? request.SentenceContext ?? ""
            };
        }

        private static string GetGenericDistractorMeaning(int index)
        {
            var distractors = new[]
            {
                "sự phát triển vượt bậc",
                "khả năng thích nghi linh hoạt",
                "hành động kiên trì, bền bỉ",
                "sự kết nối và hợp tác",
                "phương pháp tiếp cận đổi mới",
                "tính cách độc lập, tự chủ"
            };
            return distractors[index % distractors.Length];
        }

        private static string GetGenericDistractorWord(int index)
        {
            var words = new[] { "Resilience", "Innovative", "Perseverance", "Adaptable", "Efficient", "Comprehensive" };
            return words[index % words.Length];
        }

        private static int ComputeLevenshteinDistance(string s, string t)
        {
            if (string.IsNullOrEmpty(s)) return string.IsNullOrEmpty(t) ? 0 : t.Length;
            if (string.IsNullOrEmpty(t)) return s.Length;

            int[,] d = new int[s.Length + 1, t.Length + 1];

            for (int i = 0; i <= s.Length; i++) d[i, 0] = i;
            for (int j = 0; j <= t.Length; j++) d[0, j] = j;

            for (int j = 1; j <= t.Length; j++)
            {
                for (int i = 1; i <= s.Length; i++)
                {
                    int cost = (s[i - 1] == t[j - 1]) ? 0 : 1;
                    d[i, j] = Math.Min(
                        Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                        d[i - 1, j - 1] + cost);
                }
            }

            return d[s.Length, t.Length];
        }
    }
}
