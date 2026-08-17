using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using AiRiser.Core.Entities;
using AiRiser.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AiRiser.Infrastructure.Services
{
    public class VocabularyService
    {
        private readonly AppDbContext _db;
        private readonly IVectorService _vectorService;

        public VocabularyService(AppDbContext db, IVectorService vectorService)
        {
            _db = db;
            _vectorService = vectorService;
        }

        public async Task<List<VocabularyResponseDto>> GetUserVocabulariesAsync(Guid userId, string? search)
        {
            var query = _db.Vocabularies.Where(v => v.UserId == userId);

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(v => v.Word.Contains(search) || v.Meaning.Contains(search) || (v.EnglishMeaning != null && v.EnglishMeaning.Contains(search)));
            }

            return await query
                .OrderByDescending(v => v.CreatedAt)
                .Select(v => new VocabularyResponseDto(
                    v.Id,
                    v.Word,
                    v.Meaning,
                    v.EnglishMeaning,
                    v.CefrLevel,
                    v.Phonetic,
                    v.PartOfSpeech,
                    v.Example,
                    v.CustomNotes,
                    v.CreatedAt))
                .ToListAsync();
        }

        public async Task<VocabularyResponseDto> CreateVocabularyAsync(Guid userId, VocabularyCreateDto dto)
        {
            var vocab = new Vocabulary
            {
                UserId = userId,
                Word = dto.Word,
                Meaning = dto.Meaning,
                EnglishMeaning = dto.EnglishMeaning,
                CefrLevel = dto.CefrLevel,
                Phonetic = dto.Phonetic,
                PartOfSpeech = dto.PartOfSpeech,
                Example = dto.Example,
                CustomNotes = dto.CustomNotes
            };

            _db.Vocabularies.Add(vocab);

            // Initialize WordMemory for Spaced Repetition (SRS)
            var memory = new WordMemory
            {
                WordId = vocab.Id,
                UserId = userId,
                NextReviewDate = DateTime.UtcNow
            };
            _db.WordMemories.Add(memory);

            await _db.SaveChangesAsync();

            // Background / Async vector embedding sync
            try
            {
                await _vectorService.SyncVocabularyVectorAsync(vocab);
            }
            catch
            {
                // Vector sync failure should not block creation
            }

            return new VocabularyResponseDto(
                vocab.Id,
                vocab.Word,
                vocab.Meaning,
                vocab.EnglishMeaning,
                vocab.CefrLevel,
                vocab.Phonetic,
                vocab.PartOfSpeech,
                vocab.Example,
                vocab.CustomNotes,
                vocab.CreatedAt);
        }

        public async Task<BatchImportResultDto> BatchImportVocabulariesAsync(Guid userId, BatchImportVocabulariesRequestDto request)
        {
            var result = new BatchImportResultDto
            {
                TotalSubmitted = request.Words.Count,
                SuccessfullyImported = 0
            };

            var selectedWords = request.Words.Where(w => w.IsSelected && !string.IsNullOrWhiteSpace(w.Word)).ToList();
            var addedVocabs = new List<Vocabulary>();

            foreach (var item in selectedWords)
            {
                // Check if word already exists for this user
                var exists = await _db.Vocabularies.AnyAsync(v => v.UserId == userId && v.Word.ToLower() == item.Word.Trim().ToLower());
                if (exists) continue;

                var vocab = new Vocabulary
                {
                    UserId = userId,
                    Word = item.Word.Trim(),
                    Meaning = item.Meaning,
                    EnglishMeaning = item.EnglishMeaning,
                    CefrLevel = item.CefrLevel,
                    Phonetic = item.Phonetic,
                    PartOfSpeech = item.PartOfSpeech,
                    Example = item.Example,
                    CustomNotes = item.Context
                };

                _db.Vocabularies.Add(vocab);

                var memory = new WordMemory
                {
                    WordId = vocab.Id,
                    UserId = userId,
                    NextReviewDate = DateTime.UtcNow
                };
                _db.WordMemories.Add(memory);

                addedVocabs.Add(vocab);
            }

            await _db.SaveChangesAsync();

            // Sync vectors for imported words
            foreach (var vocab in addedVocabs)
            {
                try
                {
                    await _vectorService.SyncVocabularyVectorAsync(vocab);
                }
                catch {}

                result.ImportedVocabularies.Add(new VocabularyResponseDto(
                    vocab.Id,
                    vocab.Word,
                    vocab.Meaning,
                    vocab.EnglishMeaning,
                    vocab.CefrLevel,
                    vocab.Phonetic,
                    vocab.PartOfSpeech,
                    vocab.Example,
                    vocab.CustomNotes,
                    vocab.CreatedAt));
            }

            result.SuccessfullyImported = addedVocabs.Count;
            result.Message = $"Đã nhập thành công {result.SuccessfullyImported}/{result.TotalSubmitted} từ vựng và tự động tạo Vector Embeddings.";
            return result;
        }

        public async Task<bool> DeleteVocabularyAsync(Guid userId, Guid id)
        {
            var vocab = await _db.Vocabularies.FirstOrDefaultAsync(v => v.Id == id && v.UserId == userId);
            if (vocab == null) return false;

            _db.Vocabularies.Remove(vocab);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
