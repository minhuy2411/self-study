using System;
using System.Collections.Generic;

namespace AiRiser.Core.DTOs
{
    public class SrsReviewRequest
    {
        public Guid WordId { get; set; }
        /// <summary>
        /// 0: Blackout, 1: Wrong, 2: Hard, 3: Good with effort, 4: Good, 5: Perfect recall
        /// </summary>
        public int QualityRating { get; set; }
        public string? ReviewSource { get; set; } = "Flashcard";
    }

    public class SrsReviewResultDto
    {
        public Guid WordId { get; set; }
        public int RepetitionCount { get; set; }
        public int Interval { get; set; }
        public double EaseFactor { get; set; }
        public DateTime NextReviewDate { get; set; }
        public double RetentionScore { get; set; } // 0.0 to 1.0
        public string RetentionStatus { get; set; } = "Learning"; // Mastered, Retaining, Learning, Struggling
        public string FeedbackMessage { get; set; } = string.Empty;
    }

    public class WordMemoryStatusDto
    {
        public Guid WordId { get; set; }
        public string Word { get; set; } = string.Empty;
        public string Meaning { get; set; } = string.Empty;
        public string? Phonetic { get; set; }
        public string? PartOfSpeech { get; set; }
        public string? Example { get; set; }
        public int RepetitionCount { get; set; }
        public int ErrorCount { get; set; }
        public int Interval { get; set; }
        public double EaseFactor { get; set; }
        public DateTime NextReviewDate { get; set; }
        public DateTime? LastTestedAt { get; set; }
        public double RetentionScore { get; set; } // 0.0 to 1.0
        public string RetentionStatus { get; set; } = "Learning";
        public bool IsDueForReview { get; set; }
    }

    public class DailyReviewActivityDto
    {
        public string DateString { get; set; } = string.Empty; // "YYYY-MM-DD"
        public string DayOfWeek { get; set; } = string.Empty; // "T2", "T3"...
        public int ReviewCount { get; set; }
        public int CorrectCount { get; set; }
    }

    public class RetentionTiersDto
    {
        public int Mastered { get; set; }    // Retention >= 0.85 & Reps >= 4
        public int Retaining { get; set; }   // Retention >= 0.7 & Reps >= 2
        public int Learning { get; set; }    // Reps < 2 & Errors == 0
        public int Struggling { get; set; }  // Errors > 0 or Retention < 0.5
    }

    public class MemoryDashboardDto
    {
        public int TotalWords { get; set; }
        public int DueTodayCount { get; set; }
        public int MasteredCount { get; set; }
        public int WeakWordsCount { get; set; }
        public int CurrentStreakDays { get; set; }
        public double OverallRetentionRate { get; set; } // e.g. 84.5%
        public RetentionTiersDto RetentionTiers { get; set; } = new();
        public List<DailyReviewActivityDto> RecentActivity { get; set; } = new();
        public List<WordMemoryStatusDto> DueWords { get; set; } = new();
        public List<WordMemoryStatusDto> WeakWords { get; set; } = new();
    }

    public class WeakWordTipDto
    {
        public Guid WordId { get; set; }
        public string Word { get; set; } = string.Empty;
        public string Meaning { get; set; } = string.Empty;
        public int ErrorCount { get; set; }
        public string MnemonicTip { get; set; } = string.Empty;
        public string ExampleSentence { get; set; } = string.Empty;
    }

    public class AiMemorySuggestionDto
    {
        public string OverallAssessment { get; set; } = string.Empty;
        public string DailyActionPlan { get; set; } = string.Empty;
        public string RetentionForecast { get; set; } = string.Empty;
        public List<WeakWordTipDto> HighPriorityWords { get; set; } = new();
        public string MotivationalQuote { get; set; } = string.Empty;
    }
}
