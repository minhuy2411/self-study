using System;

namespace AiRiser.Core.Entities
{
    public class WordVector
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid WordId { get; set; }
        public Guid UserId { get; set; }
        
        /// <summary>
        /// Serialized float[] vector for cosine similarity computation
        /// </summary>
        public string EmbeddingJson { get; set; } = "[]";
        
        /// <summary>
        /// Contextual metadata enriched by external dictionary & RAG (definitions, synonyms, examples, tags)
        /// </summary>
        public string ContextPayload { get; set; } = "{}";
        
        public int Dimensions { get; set; } = 1536;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public Vocabulary? Vocabulary { get; set; }
        public User? User { get; set; }
    }
}
