using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AiRiser.Core.DTOs
{
    public record RegisterDto(string Email, string Password, string Name);
    public record LoginDto(string Email, string Password);
    public record AuthResponseDto(string Token, string Email, string Name);

    public record VocabularyCreateDto(
        string Word,
        string Meaning,
        string? EnglishMeaning,
        string? CefrLevel,
        string? Phonetic,
        string? PartOfSpeech,
        string? Example,
        string? CustomNotes
    );

    public record VocabularyResponseDto(
        Guid Id,
        string Word,
        string Meaning,
        string? EnglishMeaning,
        string? CefrLevel,
        string? Phonetic,
        string? PartOfSpeech,
        string? Example,
        string? CustomNotes,
        DateTime CreatedAt
    );

    public record DictionaryEntryDto(
        [property: JsonPropertyName("word")] string Word,
        [property: JsonPropertyName("phonetic")] string? Phonetic
    );

    public class CambridgeWordDetailsDto
    {
        public string Word { get; set; } = string.Empty;
        public string? Phonetic { get; set; }
        public string? PartOfSpeech { get; set; }
        public string? CefrLevel { get; set; }
        public string? EnglishDefinition { get; set; }
        public string? VietnameseTranslation { get; set; }
        public List<string> Examples { get; set; } = new();
        public List<string> Synonyms { get; set; } = new();
        public string SourceUrl { get; set; } = string.Empty;
    }

    public class ScannedWordDto
    {
        public string Word { get; set; } = string.Empty;
        public string? Phonetic { get; set; }
        public string? PartOfSpeech { get; set; }
        public string? CefrLevel { get; set; }
        public string Meaning { get; set; } = string.Empty; // Vietnamese
        public string? EnglishMeaning { get; set; }        // English definition
        public string? Example { get; set; }
        public string? Context { get; set; }
        public bool IsSelected { get; set; } = true;
    }

    public class ScanDocumentResultDto
    {
        public string DocumentName { get; set; } = string.Empty;
        public int TotalExtractedWords { get; set; }
        public List<ScannedWordDto> ExtractedWords { get; set; } = new();
    }

    public class BatchImportVocabulariesRequestDto
    {
        public List<ScannedWordDto> Words { get; set; } = new();
    }

    public class BatchImportResultDto
    {
        public int TotalSubmitted { get; set; }
        public int SuccessfullyImported { get; set; }
        public List<VocabularyResponseDto> ImportedVocabularies { get; set; } = new();
        public string Message { get; set; } = string.Empty;
    }
}
