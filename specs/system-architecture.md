# System Architecture & Technical Specifications

## 1. System Overview
App **AI-Riser** giúp người dùng học từ vựng tiếng Anh thông qua việc quản lý từ cá nhân, tích hợp **RAG (Retrieval-Augmented Generation)** kết hợp từ điển bên ngoài và **Memory AI Agent** theo dõi tiến độ ghi nhớ dựa trên đường cong quên (Forgetting Curve).

```
[ User Input / Vocab Hub ] ──────► [ Database (PostgreSQL/Supabase) ]
                                            │
                                            ▼
[ External Dictionary API ] ──────► [ Vector DB (Qdrant/Chroma/PGVector) ]
                                            │ (Embedding & Context)
                                            ▼
                                   [ RAG Engine / LLM ]
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
      [ AI Quiz Generator ]       [ Memory AI / SRS Engine ]     [ AI Progress Analytics ]
      (4 Quiz Formats)            (Tracking Weak Words)          (Personalized Feedback)
```

## 2. Technology Stack & Tech Choices
- **Frontend**: Next.js 14+ (App Router), React, TailwindCSS, Framer Motion, Lucide Icons.
- **Backend / API**: C# (.NET 8 Web API) với Clean Architecture / CQRS (MediatR).
- **Main Database**: PostgreSQL / SQL Server với Entity Framework Core (EF Core).
- **Vector Database**: **Qdrant** / **PGVector** / **ChromaDB**.
- **Embedding**: OpenAI `text-embedding-3-small` / Ollama `nomic-embed-text`.
- **RAG & LLM Engine**: Microsoft **Semantic Kernel** / **Kernel Memory** trong C# kết hợp với OpenAI GPT-4o-mini hoặc Google Gemini API.
- **External Data**: Free Dictionary API (`https://api.dictionaryapi.dev/api/v2/entries/en/<word>`).

## 3. Database Schema Overview (Key Entities)

### `User`
- `id`, `email`, `passwordHash`, `name`, `createdAt`

### `Vocabulary`
- `id`, `userId`, `word`, `phonetic`, `meaning`, `partOfSpeech`, `example`, `customNotes`, `createdAt`

### `WordVector`
- `id`, `wordId`, `embedding` (Vector 1536d / 768d), `contextPayload`

### `QuizAttempt` & `WordMemory`
- `id`, `wordId`, `userId`, `repetitionCount`, `easeFactor`, `interval`, `nextReviewDate`, `errorCount`, `lastTestedAt`

## 4. Quiz Generator & RAG Flow
1. **Fetch Candidate Words**: Hệ thống lấy từ vựng dựa trên mức độ cần ôn tập (Spaced Repetition) và danh sách "Từ hay sai".
2. **Context Enrichment via RAG**:
   - Query Vector DB / External Dictionary để lấy ví dụ phong phú, câu đồng nghĩa, ngữ cảnh câu.
3. **Prompt Construction**: LLM tạo các dạng câu hỏi:
   - *Multiple Choice*: 1 đáp án đúng + 3 nhiễu từ hợp lý (distractors).
   - *Fill in the blank*: Ẩn từ trong câu ví dụ RAG vừa tạo.
   - *ENG ➔ VIE & VIE ➔ ENG*: Dịch nghĩa & ngữ cảnh.
4. **Memory Agent Update**: Cập nhật chỉ số SRS (SuperMemo-2) ngay khi người dùng submit đáp án.
