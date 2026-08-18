using System;
using System.Collections.Generic;
using AiRiser.Core.Enums;

namespace AiRiser.Core.DTOs
{
    public class GenerateQuizRequest
    {
        public QuizType? QuizType { get; set; }
        public int Count { get; set; } = 5;
        public List<Guid>? WordIds { get; set; }
        public QuizDifficulty Difficulty { get; set; } = QuizDifficulty.Medium;
        public bool IncludeContext { get; set; } = true;
    }

    public class QuizQuestionDto
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid WordId { get; set; }
        public string TargetWord { get; set; } = string.Empty;
        public string TargetPhonetic { get; set; } = string.Empty;
        public string TargetMeaning { get; set; } = string.Empty;
        public string? EnglishMeaning { get; set; }
        public QuizType Type { get; set; }
        public string QuestionPrompt { get; set; } = string.Empty;
        public string? SentenceContext { get; set; }
        public List<string> Options { get; set; } = new();
        public string CorrectAnswer { get; set; } = string.Empty;
        public string? ExplanationHint { get; set; }
        public string? RagSourceContext { get; set; }
    }

    public class GeneratedQuizResponseDto
    {
        public Guid SessionId { get; set; } = Guid.NewGuid();
        public int TotalQuestions { get; set; }
        public List<QuizQuestionDto> Questions { get; set; } = new();
        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    }

    public class SubmitAnswerRequest
    {
        public Guid QuestionId { get; set; }
        public Guid WordId { get; set; }
        public QuizType Type { get; set; }
        public string QuestionPrompt { get; set; } = string.Empty;
        public string CorrectAnswer { get; set; } = string.Empty;
        public string UserAnswer { get; set; } = string.Empty;
        public string? SentenceContext { get; set; }
    }

    public class EvaluationResultDto
    {
        public bool IsCorrect { get; set; }
        public int Score { get; set; } // 0 - 100
        public string UserAnswer { get; set; } = string.Empty;
        public string CorrectAnswer { get; set; } = string.Empty;
        public string Feedback { get; set; } = string.Empty;
        public string DetailedExplanation { get; set; } = string.Empty;
        public string GrammarBreakdown { get; set; } = string.Empty;
        public string UsageTip { get; set; } = string.Empty;
        public string ExampleSentence { get; set; } = string.Empty;
    }

    public class SyncVectorsResponseDto
    {
        public int TotalProcessed { get; set; }
        public int SuccessCount { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class RagContextDto
    {
        public Guid WordId { get; set; }
        public string Word { get; set; } = string.Empty;
        public string Meaning { get; set; } = string.Empty;
        public string? EnglishMeaning { get; set; }
        public string? Phonetic { get; set; }
        public string? PartOfSpeech { get; set; }
        public string? Example { get; set; }
        public List<string> Synonyms { get; set; } = new();
        public List<string> RelatedSentences { get; set; } = new();
        public List<string> Collocations { get; set; } = new();
        public string FormattedPromptContext { get; set; } = string.Empty;
    }
}
