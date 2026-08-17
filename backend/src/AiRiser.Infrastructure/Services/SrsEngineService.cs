using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using AiRiser.Core.Entities;
using AiRiser.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiRiser.Infrastructure.Services
{
    public interface ISrsEngineService
    {
        Task<SrsReviewResultDto> ProcessSrsReviewAsync(Guid userId, SrsReviewRequest request);
        double CalculateRetentionScore(WordMemory memory);
        string DetermineRetentionStatus(WordMemory memory, double retentionScore);
        Task<int> CalculateUserStreakAsync(Guid userId);
        Task LogReviewAttemptAsync(Guid userId, Guid wordId, int qualityRating, int score, bool wasCorrect, int interval, double easeFactor, string source);
    }

    public class SrsEngineService : ISrsEngineService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<SrsEngineService> _logger;

        public SrsEngineService(AppDbContext context, ILogger<SrsEngineService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<SrsReviewResultDto> ProcessSrsReviewAsync(Guid userId, SrsReviewRequest request)
        {
            var q = Math.Clamp(request.QualityRating, 0, 5);

            var memory = await _context.WordMemories
                .Include(wm => wm.Vocabulary)
                .FirstOrDefaultAsync(wm => wm.WordId == request.WordId && wm.UserId == userId);

            if (memory == null)
            {
                // Create WordMemory if not exists yet
                memory = new WordMemory
                {
                    WordId = request.WordId,
                    UserId = userId,
                    RepetitionCount = 0,
                    EaseFactor = 2.5,
                    Interval = 0,
                    ErrorCount = 0,
                    NextReviewDate = DateTime.UtcNow
                };
                _context.WordMemories.Add(memory);
            }

            // SuperMemo-2 (SM-2) Core Algorithm
            if (q >= 3)
            {
                // Correct recall
                if (memory.RepetitionCount == 0)
                {
                    memory.Interval = 1;
                }
                else if (memory.RepetitionCount == 1)
                {
                    memory.Interval = 6;
                }
                else
                {
                    memory.Interval = (int)Math.Ceiling(memory.Interval * memory.EaseFactor);
                }

                memory.RepetitionCount += 1;
            }
            else
            {
                // Failed recall
                memory.RepetitionCount = 0;
                memory.Interval = 1;
                memory.ErrorCount += 1;
            }

            // Update Ease Factor (EF)
            // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
            var deltaEf = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
            memory.EaseFactor = Math.Max(1.3, Math.Round(memory.EaseFactor + deltaEf, 2));

            // Set Next Review Date
            memory.LastTestedAt = DateTime.UtcNow;
            memory.NextReviewDate = DateTime.UtcNow.AddDays(memory.Interval);

            await _context.SaveChangesAsync();

            // Log review attempt
            await LogReviewAttemptAsync(
                userId,
                request.WordId,
                q,
                q >= 3 ? 100 : (q * 20),
                q >= 3,
                memory.Interval,
                memory.EaseFactor,
                request.ReviewSource ?? "Flashcard");

            var retentionScore = CalculateRetentionScore(memory);
            var status = DetermineRetentionStatus(memory, retentionScore);

            string feedback = q switch
            {
                5 => "Tuyệt đỉnh! Trí nhớ hoàn hảo, giãn cách ôn tập đã được kéo dài.",
                4 => "Rất tốt! Bạn nhớ chính xác từ vựng này.",
                3 => "Tốt! Bạn đã nhớ được từ sau một chút nỗ lực.",
                2 => "Chưa chính xác! Hệ thống sẽ xếp lịch ôn lại vào ngày mai.",
                1 => "Gần nhớ! Cần ôn luyện thêm nhé.",
                _ => "Đã quên! Hãy xem kỹ lại ví dụ và ngữ cảnh để củng cố trí nhớ."
            };

            return new SrsReviewResultDto
            {
                WordId = request.WordId,
                RepetitionCount = memory.RepetitionCount,
                Interval = memory.Interval,
                EaseFactor = memory.EaseFactor,
                NextReviewDate = memory.NextReviewDate,
                RetentionScore = retentionScore,
                RetentionStatus = status,
                FeedbackMessage = feedback
            };
        }

        public double CalculateRetentionScore(WordMemory memory)
        {
            if (memory.LastTestedAt == null) return 1.0;

            var daysElapsed = (DateTime.UtcNow - memory.LastTestedAt.Value).TotalDays;
            if (daysElapsed <= 0) return 1.0;

            // Stability factor based on interval and ease factor
            var stability = Math.Max(1.0, memory.Interval * (memory.EaseFactor / 2.5));

            // Ebbinghaus forgetting curve formula: R = e^(-t / S)
            var retention = Math.Exp(-daysElapsed / stability);
            return Math.Round(Math.Clamp(retention, 0.05, 1.0), 2);
        }

        public string DetermineRetentionStatus(WordMemory memory, double retentionScore)
        {
            if (memory.ErrorCount >= 2 && retentionScore < 0.60)
            {
                return "Struggling"; // Hay quên / Từ yếu
            }
            if (retentionScore >= 0.85 && memory.RepetitionCount >= 4)
            {
                return "Mastered"; // Thành thạo
            }
            if (retentionScore >= 0.70 && memory.RepetitionCount >= 2)
            {
                return "Retaining"; // Đang ghi nhớ tốt
            }
            return "Learning"; // Đang học
        }

        public async Task<int> CalculateUserStreakAsync(Guid userId)
        {
            var reviewDates = await _context.WordReviewLogs
                .Where(rl => rl.UserId == userId)
                .Select(rl => rl.ReviewedAt.Date)
                .Distinct()
                .OrderByDescending(d => d)
                .ToListAsync();

            if (!reviewDates.Any()) return 0;

            var today = DateTime.UtcNow.Date;
            int streak = 0;
            var checkDate = today;

            // If user hasn't reviewed today yet, check if they reviewed yesterday
            if (!reviewDates.Contains(today))
            {
                checkDate = today.AddDays(-1);
                if (!reviewDates.Contains(checkDate))
                {
                    return 0;
                }
            }

            while (reviewDates.Contains(checkDate))
            {
                streak++;
                checkDate = checkDate.AddDays(-1);
            }

            return streak;
        }

        public async Task LogReviewAttemptAsync(
            Guid userId,
            Guid wordId,
            int qualityRating,
            int score,
            bool wasCorrect,
            int interval,
            double easeFactor,
            string source)
        {
            try
            {
                var log = new WordReviewLog
                {
                    UserId = userId,
                    WordId = wordId,
                    QualityRating = qualityRating,
                    Score = score,
                    WasCorrect = wasCorrect,
                    IntervalDays = interval,
                    EaseFactor = easeFactor,
                    ReviewSource = source,
                    ReviewedAt = DateTime.UtcNow
                };
                _context.WordReviewLogs.Add(log);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to log word review attempt for WordId: {WordId}", wordId);
            }
        }
    }
}
