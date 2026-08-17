# Project Tasks & Roadmap: AI Vocabulary & Quiz System (AI-Riser)

## Phase 1: Foundation & Core Vocabulary Management
- [x] Initialize C# (.NET 8/10 Web API) solution structure (Clean Architecture / WebAPI) in `E:\huynguyen\ai-riser\backend`
- [x] Initialize Next.js project with TailwindCSS and TypeScript in `E:\huynguyen\ai-riser\frontend`
- [x] Design & setup Database Schema (User, Word, VocabularySet, WordProgress) using Entity Framework Core (EF Core)
- [x] Build Authentication APIs (Register/Login with password hashing BCrypt/Argon2 & JWT Token) in C# Backend
- [x] Build UI & API for Vocabulary Management (Add, Edit, Delete, Search, Categorize)
- [x] Integrate External English Dictionary API via C# `HttpClient` (e.g., Free Dictionary API) for automated definitions & pronunciations

## Phase 2: RAG Pipeline & AI Quiz Generator
- [x] Integrate Vector Database (Qdrant / ChromaDB / PGVector) for embedding word context & dictionary references
- [x] Build RAG Pipeline (Retrieval Augmented Generation) using OpenAI / Gemini / Ollama
- [x] Build AI Quiz Generator module supporting 4 Quiz formats:
  - [x] Multiple choice (Word ➔ Meaning / Meaning ➔ Word)
  - [x] Fill in the blanks (AI contextual sentences)
  - [x] English to Vietnamese translation
  - [x] Vietnamese to English translation
- [x] Real-time scoring and answer explanation generator using AI

## Phase 3: Memory AI & Spaced Repetition (SRS)
- [x] Implement Spaced Repetition Algorithm (SuperMemo-2 / Leitner System)
- [x] Build Error Tracking Engine (Weak words logger & mistake review mode)
- [x] Build Memory AI Agent (Personalized study suggestions based on user forgetting curve)
- [x] Analytics & Progress Dashboard (Visual charts for memory strength & streak)

## Phase 4: UI/UX Perfection & Deployment
- [x] Implement dark/light mode, micro-animations (Framer Motion)
- [x] Sound effects & Pronunciation audio player integration
- [x] UI/UX Pro Max Educational Platform design overhaul (Contrast, accessibility, keyboard shortcuts)
- [x] E2E Testing & Performance Tuning
- [ ] Deployment (Vercel / Docker containerization - deferred for later)

## Phase 5: Smart Document/PDF Scanner & Cambridge Dictionary RAG
- [x] PDF & Document Scanner Engine (`UglyToad.PdfPig` + Structured LLM Extraction)
- [x] Cambridge Dictionary RAG Service (`dictionary.cambridge.org` scraper + CALD knowledge model)
- [x] Dual-Meaning Vocabulary Schema (`EnglishMeaning` & `CefrLevel` A1-C2 support)
- [x] Interactive Batch Review & Import UI Modal with instant Vector DB generation
- [x] Educational Platform Dual-Card Display (Vietnamese Meaning + Cambridge English Definition)
