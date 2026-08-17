using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using AiRiser.Core.Entities;
using AiRiser.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiRiser.Infrastructure.Services
{
    public interface IRagPipelineService
    {
        Task<RagContextDto> BuildRagContextAsync(Guid userId, Vocabulary vocab);
        Task<List<RagContextDto>> BuildBatchRagContextAsync(Guid userId, List<Vocabulary> vocabList);
        string FormatRagPrompt(RagContextDto ragContext);
    }

    public class RagPipelineService : IRagPipelineService
    {
        private readonly AppDbContext _context;
        private readonly IVectorService _vectorService;
        private readonly ExternalDictionaryService _dictionaryService;
        private readonly ILogger<RagPipelineService> _logger;

        public RagPipelineService(
            AppDbContext context,
            IVectorService vectorService,
            ExternalDictionaryService dictionaryService,
            ILogger<RagPipelineService> logger)
        {
            _context = context;
            _vectorService = vectorService;
            _dictionaryService = dictionaryService;
            _logger = logger;
        }

        public async Task<RagContextDto> BuildRagContextAsync(Guid userId, Vocabulary vocab)
        {
            var ragContext = new RagContextDto
            {
                WordId = vocab.Id,
                Word = vocab.Word,
                Meaning = vocab.Meaning,
                Phonetic = vocab.Phonetic,
                PartOfSpeech = vocab.PartOfSpeech,
                Example = vocab.Example
            };

            // 1. Fetch External Dictionary data
            try
            {
                var dictEntries = await _dictionaryService.GetDefinitionAsync(vocab.Word);
                if (dictEntries != null && dictEntries.Count > 0)
                {
                    foreach (var entry in dictEntries)
                    {
                        if (string.IsNullOrEmpty(ragContext.Phonetic) && !string.IsNullOrEmpty(entry.Phonetic))
                        {
                            ragContext.Phonetic = entry.Phonetic;
                        }

                        if (entry.Meanings != null)
                        {
                            foreach (var m in entry.Meanings)
                            {
                                if (m.Synonyms != null)
                                {
                                    foreach (var syn in m.Synonyms)
                                    {
                                        if (!ragContext.Synonyms.Contains(syn) && ragContext.Synonyms.Count < 5)
                                        {
                                            ragContext.Synonyms.Add(syn);
                                        }
                                    }
                                }

                                if (m.Definitions != null)
                                {
                                    foreach (var def in m.Definitions)
                                    {
                                        if (!string.IsNullOrEmpty(def.Example) && !ragContext.RelatedSentences.Contains(def.Example) && ragContext.RelatedSentences.Count < 4)
                                        {
                                            ragContext.RelatedSentences.Add(def.Example);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch external dictionary context for word '{Word}'", vocab.Word);
            }

            // 2. Query Vector DB for semantically similar words or saved context
            try
            {
                var similarVocabs = await _vectorService.SearchSimilarWordsAsync(userId, vocab.Word, 3, vocab.Id);
                foreach (var sim in similarVocabs)
                {
                    if (!string.IsNullOrEmpty(sim.Example) && !ragContext.RelatedSentences.Contains(sim.Example) && ragContext.RelatedSentences.Count < 5)
                    {
                        ragContext.RelatedSentences.Add($"[Context: {sim.Word}] {sim.Example}");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to query vector similarity context for '{Word}'", vocab.Word);
            }

            // If no sentences found, add standard contextual fallback sentences
            if (ragContext.RelatedSentences.Count == 0)
            {
                if (!string.IsNullOrEmpty(vocab.Example))
                {
                    ragContext.RelatedSentences.Add(vocab.Example);
                }
                else
                {
                    ragContext.RelatedSentences.Add($"She tried to use the word '{vocab.Word}' correctly in her essay.");
                }
            }

            ragContext.FormattedPromptContext = FormatRagPrompt(ragContext);
            return ragContext;
        }

        public async Task<List<RagContextDto>> BuildBatchRagContextAsync(Guid userId, List<Vocabulary> vocabList)
        {
            var tasks = vocabList.Select(v => BuildRagContextAsync(userId, v));
            var results = await Task.WhenAll(tasks);
            return results.ToList();
        }

        public string FormatRagPrompt(RagContextDto rag)
        {
            var synonymsText = rag.Synonyms.Any() ? string.Join(", ", rag.Synonyms) : "None";
            var sentencesText = rag.RelatedSentences.Any() ? string.Join("\n - ", rag.RelatedSentences) : "None";

            return $"""
            [RETRIEVED VOCABULARY CONTEXT]
            Target Word: {rag.Word}
            Phonetic: {rag.Phonetic ?? "N/A"}
            Part of Speech: {rag.PartOfSpeech ?? "N/A"}
            Core Meaning (Vietnamese/English): {rag.Meaning}
            Synonyms: {synonymsText}
            Contextual Example Sentences:
             - {sentencesText}
            """;
        }
    }
}
