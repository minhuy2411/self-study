using System;
using System.Security.Claims;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using AiRiser.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AiRiser.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class VocabulariesController : ControllerBase
    {
        private readonly VocabularyService _vocabService;
        private readonly ExternalDictionaryService _dictService;
        private readonly ICambridgeDictionaryService _cambridgeService;
        private readonly IDocumentScannerService _scannerService;

        public VocabulariesController(
            VocabularyService vocabService,
            ExternalDictionaryService dictService,
            ICambridgeDictionaryService cambridgeService,
            IDocumentScannerService scannerService)
        {
            _vocabService = vocabService;
            _dictService = dictService;
            _cambridgeService = cambridgeService;
            _scannerService = scannerService;
        }

        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            return Guid.Parse(userIdClaim!);
        }

        [HttpGet]
        public async Task<IActionResult> GetVocabularies([FromQuery] string? search)
        {
            var list = await _vocabService.GetUserVocabulariesAsync(GetUserId(), search);
            return Ok(list);
        }

        [HttpPost]
        public async Task<IActionResult> CreateVocabulary([FromBody] VocabularyCreateDto dto)
        {
            var result = await _vocabService.CreateVocabularyAsync(GetUserId(), dto);
            return CreatedAtAction(nameof(GetVocabularies), new { id = result.Id }, result);
        }

        [HttpPost("batch-import")]
        public async Task<IActionResult> BatchImport([FromBody] BatchImportVocabulariesRequestDto dto)
        {
            var result = await _vocabService.BatchImportVocabulariesAsync(GetUserId(), dto);
            return Ok(result);
        }

        [HttpPost("scan-document")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ScanDocument([FromForm] IFormFile? file, [FromForm] string? rawText)
        {
            if ((file == null || file.Length == 0) && string.IsNullOrWhiteSpace(rawText))
            {
                return BadRequest(new { message = "Vui lòng tải lên tệp PDF hoặc dán đoạn văn bản cần quét." });
            }

            using var stream = file?.OpenReadStream();
            var result = await _scannerService.ScanPdfOrTextAsync(stream, file?.FileName, rawText);
            return Ok(result);
        }

        [HttpPost("scan-text")]
        public async Task<IActionResult> ScanText([FromBody] ScanTextRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.RawText))
            {
                return BadRequest(new { message = "Văn bản quét không được để trống." });
            }

            var result = await _scannerService.ScanPdfOrTextAsync(null, "Văn bản dán", request.RawText);
            return Ok(result);
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteVocabulary(Guid id)
        {
            var success = await _vocabService.DeleteVocabularyAsync(GetUserId(), id);
            if (!success) return NotFound();
            return NoContent();
        }

        [AllowAnonymous]
        [HttpGet("dictionary/{word}")]
        public async Task<IActionResult> LookupDictionary(string word)
        {
            var data = await _dictService.FetchWordDefinitionAsync(word);
            if (data == null) return NotFound(new { message = "Word not found in dictionary." });
            return Ok(data);
        }

        /// <summary>
        /// RAG lookup directly from Cambridge Advanced Learner's Dictionary
        /// </summary>
        [HttpGet("cambridge/{word}")]
        public async Task<IActionResult> LookupCambridgeDictionary(string word)
        {
            var data = await _cambridgeService.LookupWordAsync(word);
            return Ok(data);
        }
    }

    public class ScanTextRequest
    {
        public string RawText { get; set; } = string.Empty;
    }
}
