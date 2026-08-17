using System;

namespace AiRiser.Core.Entities
{
    public class WordReviewLog
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid WordId { get; set; }
        public Guid UserId { get; set; }
        
        /// <summary>
        /// SuperMemo-2 Quality rating from 0 (blackout) to 5 (perfect recall)
        /// </summary>
        public int QualityRating { get; set; }
        
        public int Score { get; set; }
        public bool WasCorrect { get; set; }
        public int IntervalDays { get; set; }
        public double EaseFactor { get; set; }
        public string? ReviewSource { get; set; } // "Quiz" | "Flashcard" | "MistakeReview"
        public DateTime ReviewedAt { get; set; } = DateTime.UtcNow;

        public Vocabulary? Vocabulary { get; set; }
        public User? User { get; set; }
    }
}
