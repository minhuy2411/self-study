# AI Vocabulary Builder & Smart Quiz Master (AI-Riser)

Chào bạn! Dưới đây là plan tổng thể, kiến trúc kĩ thuật, công nghệ đề xuất và hệ thống tài liệu (documentation) cho dự án ứng dụng Học từ vựng Tiếng Anh tích hợp AI, RAG và Memory Tracking tại đường dẫn `E:\huynguyen\ai-riser`.

---

## 1. Đề xuất Công nghệ & Kiến trúc Kĩ thuật (Tech Stack & Architecture)

### A. Core Stack đề xuất
1. **Frontend**: Next.js 14+ (App Router), React, TailwindCSS, Lucide Icons, Framer Motion (cho micro-animations & quiz transitions).
2. **Backend / API**: C# (.NET 8 Web API) clean architecture, Entity Framework Core (EF Core), Semantic Kernel / Kernel Memory cho AI Orchestration & RAG.
3. **Database (Chính)**: 
   - **PostgreSQL / SQL Server / Entity Framework Core**: Lưu thông tin User, bộ từ vựng (Vocabularies), Lịch sử làm bài (Quiz Attempts), Thống kê từ sai (Spaced Repetition / Memory tracking).
4. **Vector Database & RAG System**:
   - **Vector DB**: **Qdrant** hoặc **ChromaDB** / **Pinecone** (hoặc mở rộng PGVector ngay trong PostgreSQL).
   - **Embedding Model**: OpenAI `text-embedding-3-small` hoặc Ollama (Local embedding như `nomic-embed-text`).
   - **RAG Data Sources**: 
     - Tích hợp Free Dictionary API (ví dụ: `api.dictionaryapi.dev`) hoặc WordNet / Custom Dictionary Dataset.
     - Vectorize context từ từ điển & các đoạn văn/ví dụ để tìm từ đồng nghĩa (synonyms), ngữ cảnh sử dụng (collocations/context).
5. **AI / LLM Orchestration**:
   - **Framework**: LangChain / LlamaIndex hoặc Vercel AI SDK.
   - **LLM Provider**: OpenAI API (GPT-4o-mini / GPT-4o) hoặc Google Gemini API / Claude API (có thể hỗ trợ thêm Local LLM qua Ollama).

---

## 2. Các Tính năng Cốt lõi (Key Features)

1. **Quản lý Từ vựng (Vocabulary Hub)**:
   - Thêm từ mới: Word, Meaning, Example, Part of Speech, Audio pronunciation.
   - AI Auto-enrichment: Khi user nhập từ, AI tự tra từ điển + RAG để đề xuất nghĩa chuẩn, ví dụ thực tế và collocation.
2. **AI Quiz Generator (Đa dạng hình thức Quiz)**:
   - **Multiple Choice** (Trắc nghiệm chọn nghĩa hoặc chọn từ).
   - **Fill-in-the-blank** (Điền từ vào câu ví dụ do AI tạo).
   - **English ➔ Vietnamese** & **Vietnamese ➔ English**.
   - AI điều chỉnh độ khó của Quiz dựa trên từ sai và lịch sử của người dùng.
3. **Memory AI & Error Tracking System**:
   - Theo dõi danh sách "Từ hay sai" (Weak Words).
   - Áp dụng thuật toán Spaced Repetition (SRS / SuperMemo-2) kết hợp AI Memory Agent để nhắc nhở từ ôn tập theo đường cong quên (Forgetting Curve).
4. **AI Personal Coach & Progress Analytics**:
   - Đánh giá trình độ và thói quen học tập của người dùng qua biểu đồ.
   - Trợ lý AI đưa ra lời khuyên cá nhân hóa hàng ngày.

---

## 3. Cấu trúc Tài liệu Dự án (Project Specs & Docs)

Tất cả tài liệu được khởi tạo tại `E:\huynguyen\ai-riser\specs\` để tiện theo dõi, quản lý và đánh giá theo từng giai đoạn:

```
E:\huynguyen\ai-riser/
├── specs/
│   ├── system-architecture.md   # Kiến trúc chi tiết, RAG pipeline, Database Schema
│   ├── tasks.md                 # Roadmap tổng thể & Task breakdown
│   ├── phase-01-core-vocab.md   # Phase 1: Quản lý từ vựng & Auth
│   ├── phase-02-ai-quiz-rag.md  # Phase 2: RAG Integration & Quiz Generator
│   └── phase-03-memory-agent.md # Phase 3: Memory AI & Analytics
└── README.md
```

---

## 4. Kế hoạch Triển khai (Implementation Roadmap)

| Giai đoạn | Nội dung chính | Sản phẩm đầu ra |
|---|---|---|
| **Phase 1: Foundation & Vocab Management** | Đặt tả DB schema, dựng giao diện CRUD từ vựng, tích hợp Free Dictionary API | App quản lý từ vựng cá nhân chuẩn |
| **Phase 2: RAG Integration & AI Quiz** | Tích hợp Vector DB, RAG tra cứu từ điển mở rộng, bộ sinh Quiz 4 dạng | Hệ thống Quiz tự động sinh bằng AI |
| **Phase 3: Memory AI & Error Tracking** | Thuật toán SRS (Spaced Repetition), tracking từ hay sai, Dashboard phân tích | AI Coach & Lộ trình ghi nhớ thông minh |
| **Phase 4: Polish, UI/UX & Optimization** | Micro-animations, responsive, dark/light mode, PWA/Offline support | App hoàn chỉnh ready for launch |

---

> **Lưu ý**: Bạn có thể chuyển thư mục làm việc chính sang `E:\huynguyen\ai-riser` trong workspace để tiện thao tác tiếp theo!
