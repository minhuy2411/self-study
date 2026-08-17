using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using AiRiser.Core.Entities;
using AiRiser.Core.Enums;
using AiRiser.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiRiser.Infrastructure.Services
{
    public interface IQuizService
    {
        Task<GeneratedQuizResponseDto> GenerateQuizSessionAsync(Guid userId, GenerateQuizRequest request);
        Task<EvaluationResultDto> EvaluateQuestionAnswerAsync(Guid userId, SubmitAnswerRequest request);
    }

    public class QuizService : IQuizService
    {
        private readonly AppDbContext _context;
        private readonly IVectorService _vectorService;
        private readonly IRagPipelineService _ragPipeline;
        private readonly IAiService _aiService;
        private readonly ISrsEngineService _srsEngine;
        private readonly ILogger<QuizService> _logger;

        public QuizService(
            AppDbContext context,
            IVectorService vectorService,
            IRagPipelineService ragPipeline,
            IAiService aiService,
            ISrsEngineService srsEngine,
            ILogger<QuizService> logger)
        {
            _context = context;
            _vectorService = vectorService;
            _ragPipeline = ragPipeline;
            _aiService = aiService;
            _srsEngine = srsEngine;
            _logger = logger;
        }

        public async Task<GeneratedQuizResponseDto> GenerateQuizSessionAsync(Guid userId, GenerateQuizRequest request)
        {
            var requestedCount = Math.Clamp(request.Count, 1, 30);

            // 1. Fetch user vocabularies
            List<Vocabulary> targetVocabs;
            if (request.WordIds != null && request.WordIds.Count > 0)
            {
                targetVocabs = await _context.Vocabularies
                    .Where(v => v.UserId == userId && request.WordIds.Contains(v.Id))
                    .ToListAsync();
            }
            else
            {
                // Prioritize words that have higher error count or need review
                targetVocabs = await _context.Vocabularies
                    .Include(v => v.WordMemory)
                    .Where(v => v.UserId == userId)
                    .OrderByDescending(v => v.WordMemory != null ? v.WordMemory.ErrorCount : 0)
                    .ThenBy(v => v.CreatedAt)
                    .Take(requestedCount)
                    .ToListAsync();
            }

            // Fallback: If user has 0 vocabularies, provide default curated study vocabulary
            if (targetVocabs.Count == 0)
            {
                targetVocabs = GetCuratedStarterVocabularies(userId).Take(requestedCount).ToList();
            }

            // 2. Fetch distractors for multiple choice options
            var distractorsMap = new Dictionary<Guid, List<string>>();
            foreach (var vocab in targetVocabs)
            {
                var distractors = await _vectorService.GetSemanticDistractorsAsync(userId, vocab, 3);
                if (request.QuizType == QuizType.MultipleChoiceMeaningToWord)
                {
                    distractorsMap[vocab.Id] = distractors.Select(d => d.Word).ToList();
                }
                else
                {
                    distractorsMap[vocab.Id] = distractors.Select(d => d.Meaning).ToList();
                }
            }

            // 3. Build RAG contextual enrichment for all selected words
            var ragContexts = await _ragPipeline.BuildBatchRagContextAsync(userId, targetVocabs);

            // 4. Generate structured questions via AI Service
            var questions = await _aiService.GenerateQuizQuestionsAsync(
                ragContexts,
                request.QuizType,
                request.Difficulty,
                distractorsMap);

            return new GeneratedQuizResponseDto
            {
                SessionId = Guid.NewGuid(),
                TotalQuestions = questions.Count,
                Questions = questions,
                GeneratedAt = DateTime.UtcNow
            };
        }

        public async Task<EvaluationResultDto> EvaluateQuestionAnswerAsync(Guid userId, SubmitAnswerRequest request)
        {
            Vocabulary? vocab = null;
            if (request.WordId != Guid.Empty)
            {
                vocab = await _context.Vocabularies
                    .Include(v => v.WordMemory)
                    .FirstOrDefaultAsync(v => v.Id == request.WordId && v.UserId == userId);
            }

            RagContextDto? ragContext = null;
            if (vocab != null)
            {
                ragContext = await _ragPipeline.BuildRagContextAsync(userId, vocab);
            }

            var evalResult = await _aiService.EvaluateAnswerAsync(request, ragContext);

            // Update WordMemory stats & SM-2
            if (vocab != null)
            {
                int rating = evalResult.IsCorrect ? (evalResult.Score >= 90 ? 5 : 4) : 1;
                await _srsEngine.ProcessSrsReviewAsync(userId, new SrsReviewRequest
                {
                    WordId = vocab.Id,
                    QualityRating = rating,
                    ReviewSource = "Quiz"
                });
            }

            return evalResult;
        }

        private static List<Vocabulary> GetCuratedStarterVocabularies(Guid userId)
        {
            return new List<Vocabulary>
            {
                new Vocabulary
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Word = "Resilience",
                    Phonetic = "/rɪˈzɪl.jəns/",
                    Meaning = "Khả năng phục hồi, kiên cường vượt qua khó khăn",
                    PartOfSpeech = "Noun",
                    Example = "Courage and resilience helped her overcome the tragedy.",
                    CustomNotes = "IELTS 7.0 topic Mental Health"
                },
                new Vocabulary
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Word = "Metacognition",
                    Phonetic = "/ˌmet.ə.kɒɡˈnɪʃ.ən/",
                    Meaning = "Nhận thức về quá trình tư duy của chính mình (siêu nhận thức)",
                    PartOfSpeech = "Noun",
                    Example = "Metacognition allows learners to plan and assess their own learning.",
                    CustomNotes = "Psychology and Education keyword"
                },
                new Vocabulary
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Word = "Eloquent",
                    Phonetic = "/ˈel.ə.kwənt/",
                    Meaning = "Hùng biện, lưu loát và giàu sức thuyết phục",
                    PartOfSpeech = "Adjective",
                    Example = "She gave an eloquent speech that moved the entire audience.",
                    CustomNotes = "Writing & Speaking advanced"
                },
                new Vocabulary
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Word = "Paradigm",
                    Phonetic = "/ˈpær.ə.daɪm/",
                    Meaning = "Mô hình mẫu, hệ biến hóa tư duy",
                    PartOfSpeech = "Noun",
                    Example = "The internet caused a paradigm shift in how people communicate.",
                    CustomNotes = "Academic reading term"
                },
                new Vocabulary
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Word = "Ubiquitous",
                    Phonetic = "/juːˈbɪk.wɪ.təs/",
                    Meaning = "Phổ biến ở khắp mọi nơi",
                    PartOfSpeech = "Adjective",
                    Example = "Smartphones have become ubiquitous in modern society.",
                    CustomNotes = "Technology & Society"
                }
            };
        }
    }
}
