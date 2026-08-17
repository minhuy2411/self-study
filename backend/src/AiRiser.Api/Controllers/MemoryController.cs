using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using AiRiser.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiRiser.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MemoryController : ControllerBase
    {
        private readonly IMemoryAiService _memoryAiService;
        private readonly ISrsEngineService _srsEngineService;

        public MemoryController(
            IMemoryAiService memoryAiService,
            ISrsEngineService srsEngineService)
        {
            _memoryAiService = memoryAiService;
            _srsEngineService = srsEngineService;
        }

        private Guid GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
            if (claim != null && Guid.TryParse(claim.Value, out var userId))
            {
                return userId;
            }
            throw new UnauthorizedAccessException("User is not authenticated.");
        }

        /// <summary>
        /// Retrieves the comprehensive Memory & Spaced Repetition (SRS) Dashboard stats
        /// </summary>
        [HttpGet("dashboard")]
        public async Task<ActionResult<MemoryDashboardDto>> GetDashboard()
        {
            var userId = GetUserId();
            var stats = await _memoryAiService.GetDashboardStatsAsync(userId);
            return Ok(stats);
        }

        /// <summary>
        /// Retrieves words currently due for Spaced Repetition review
        /// </summary>
        [HttpGet("due")]
        public async Task<ActionResult<List<WordMemoryStatusDto>>> GetDueWords()
        {
            var userId = GetUserId();
            var dueWords = await _memoryAiService.GetDueWordsAsync(userId);
            return Ok(dueWords);
        }

        /// <summary>
        /// Retrieves weak and struggling words for Mistake Review Mode
        /// </summary>
        [HttpGet("weak")]
        public async Task<ActionResult<List<WordMemoryStatusDto>>> GetWeakWords()
        {
            var userId = GetUserId();
            var weakWords = await _memoryAiService.GetWeakWordsAsync(userId);
            return Ok(weakWords);
        }

        /// <summary>
        /// Submits a SuperMemo-2 (SM-2) review rating (0 to 5) for a vocabulary word
        /// </summary>
        [HttpPost("review")]
        public async Task<ActionResult<SrsReviewResultDto>> SubmitSrsReview([FromBody] SrsReviewRequest request)
        {
            var userId = GetUserId();
            var result = await _srsEngineService.ProcessSrsReviewAsync(userId, request);
            return Ok(result);
        }

        /// <summary>
        /// Generates personalized study suggestions and mnemonics from the Memory AI Coach
        /// </summary>
        [HttpGet("suggestions")]
        public async Task<ActionResult<AiMemorySuggestionDto>> GetAiSuggestions()
        {
            var userId = GetUserId();
            var suggestions = await _memoryAiService.GenerateAiMemorySuggestionsAsync(userId);
            return Ok(suggestions);
        }
    }
}
