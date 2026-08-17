using System;

namespace AiRiser.Core.Entities
{
    public class Vocabulary
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string Word { get; set; } = string.Empty;
        public string? Phonetic { get; set; }
        public string Meaning { get; set; } = string.Empty;
        public string? EnglishMeaning { get; set; }
        public string? CefrLevel { get; set; } // A1, A2, B1, B2, C1, C2
        public string? PartOfSpeech { get; set; }
        public string? Example { get; set; }
        public string? CustomNotes { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public User? User { get; set; }
        public WordMemory? WordMemory { get; set; }
    }
}
