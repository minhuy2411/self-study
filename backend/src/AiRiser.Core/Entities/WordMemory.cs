using System;

namespace AiRiser.Core.Entities
{
    public class WordMemory
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid WordId { get; set; }
        public Guid UserId { get; set; }
        public int RepetitionCount { get; set; } = 0;
        public double EaseFactor { get; set; } = 2.5;
        public int Interval { get; set; } = 0;
        public DateTime NextReviewDate { get; set; } = DateTime.UtcNow;
        public int ErrorCount { get; set; } = 0;
        public DateTime? LastTestedAt { get; set; }

        public Vocabulary? Vocabulary { get; set; }
        public User? User { get; set; }
    }
}
