using System;
using System.Security.Claims;
using System.Threading.Tasks;
using AiRiser.Core.DTOs;
using AiRiser.Infrastructure.Data;
using AiRiser.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiRiser.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class QuizController : ControllerBase
    {
        private readonly IQuizService _quizService;
        private readonly IVectorService _vectorService;
        private readonly IRagPipelineService _ragPipelineService;
        private readonly AppDbContext _context;

        public QuizController(
            IQuizService quizService,
            IVectorService vectorService,
            IRagPipelineService ragPipelineService,
            AppDbContext context)
        {
            _quizService = quizService;
            _vectorService = vectorService;
            _ragPipelineService = ragPipelineService;
            _context = context;
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
        /// Generates a set of RAG-powered quiz questions across 4 formats
        /// </summary>
        [HttpPost("generate")]
        public async Task<ActionResult<GeneratedQuizResponseDto>> GenerateQuiz([FromBody] GenerateQuizRequest request)
        {
            var userId = GetUserId();
            var result = await _quizService.GenerateQuizSessionAsync(userId, request);
            return Ok(result);
        }

        /// <summary>
        /// Evaluates a submitted answer in real-time using AI and provides detailed explanations
        /// </summary>
        [HttpPost("evaluate")]
        public async Task<ActionResult<EvaluationResultDto>> EvaluateAnswer([FromBody] SubmitAnswerRequest request)
        {
            var userId = GetUserId();
            var result = await _quizService.EvaluateQuestionAnswerAsync(userId, request);
            return Ok(result);
        }

        /// <summary>
        /// Syncs or embeds vectors for all vocabulary words of the current user
        /// </summary>
        [HttpPost("sync-vectors")]
        public async Task<ActionResult<SyncVectorsResponseDto>> SyncVectors()
        {
            var userId = GetUserId();
            var processed = await _vectorService.SyncAllUserVectorsAsync(userId);
            return Ok(new SyncVectorsResponseDto
            {
                TotalProcessed = processed,
                SuccessCount = processed,
                Message = $"Successfully synced vector embeddings for {processed} vocabulary words."
            });
        }

        /// <summary>
        /// Inspects the RAG enriched context for a vocabulary word
        /// </summary>
        [HttpGet("rag-context/{wordId}")]
        public async Task<ActionResult<RagContextDto>> GetRagContext(Guid wordId)
        {
            var userId = GetUserId();
            var vocab = await _context.Vocabularies.FirstOrDefaultAsync(v => v.Id == wordId && v.UserId == userId);
            if (vocab == null)
            {
                return NotFound(new { message = "Vocabulary not found" });
            }

            var ragContext = await _ragPipelineService.BuildRagContextAsync(userId, vocab);
            return Ok(ragContext);
        }
    }
}
