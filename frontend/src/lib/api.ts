const getApiBase = () => {
  let base = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5078/api"
  ).trim().replace(/\/+$/, "");
  if (!base.endsWith("/api")) {
    base += "/api";
  }
  return base;
};

const API_BASE = getApiBase();

export interface Vocabulary {
  id: string;
  word: string;
  meaning: string;
  englishMeaning?: string;
  cefrLevel?: string;
  phonetic?: string;
  partOfSpeech?: string;
  example?: string;
  customNotes?: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  email: string;
  name: string;
}

export enum QuizType {
  MultipleChoiceWordToMeaning = 1,
  MultipleChoiceMeaningToWord = 2,
  FillInTheBlank = 3,
  EnglishToVietnamese = 4,
  VietnameseToEnglish = 5,
}

export enum QuizDifficulty {
  Easy = 1,
  Medium = 2,
  Hard = 3,
}

export interface QuizQuestion {
  id: string;
  wordId: string;
  targetWord: string;
  targetPhonetic?: string;
  targetMeaning: string;
  type: QuizType;
  questionPrompt: string;
  sentenceContext?: string;
  options: string[];
  correctAnswer: string;
  explanationHint?: string;
  ragSourceContext?: string;
}

export interface GeneratedQuizResponse {
  sessionId: string;
  totalQuestions: number;
  questions: QuizQuestion[];
  generatedAt: string;
}

export interface SubmitAnswerRequest {
  questionId: string;
  wordId: string;
  type: QuizType;
  questionPrompt: string;
  correctAnswer: string;
  userAnswer: string;
  sentenceContext?: string;
}

export interface EvaluationResult {
  isCorrect: boolean;
  score: number; // 0-100
  userAnswer: string;
  correctAnswer: string;
  feedback: string;
  detailedExplanation: string;
  grammarBreakdown: string;
  usageTip: string;
  exampleSentence: string;
}

export interface SyncVectorsResponse {
  totalProcessed: number;
  successCount: number;
  message: string;
}

export interface RagContext {
  wordId: string;
  word: string;
  meaning: string;
  phonetic?: string;
  partOfSpeech?: string;
  example?: string;
  synonyms: string[];
  relatedSentences: string[];
  collocations: string[];
  formattedPromptContext: string;
}

// Spaced Repetition (SRS) & Memory AI Interfaces
export interface SrsReviewRequest {
  wordId: string;
  qualityRating: number; // 0-5
  reviewSource?: string;
}

export interface SrsReviewResult {
  wordId: string;
  repetitionCount: number;
  interval: number;
  easeFactor: number;
  nextReviewDate: string;
  retentionScore: number;
  retentionStatus: "Mastered" | "Retaining" | "Learning" | "Struggling";
  feedbackMessage: string;
}

export interface WordMemoryStatus {
  wordId: string;
  word: string;
  meaning: string;
  englishMeaning?: string;
  cefrLevel?: string;
  phonetic?: string;
  partOfSpeech?: string;
  example?: string;
  repetitionCount: number;
  errorCount: number;
  interval: number;
  easeFactor: number;
  nextReviewDate: string;
  lastTestedAt?: string;
  retentionScore: number;
  retentionStatus: "Mastered" | "Retaining" | "Learning" | "Struggling";
  isDueForReview: boolean;
}

export interface DailyReviewActivity {
  dateString: string;
  dayOfWeek: string;
  reviewCount: number;
  correctCount: number;
}

export interface RetentionTiers {
  mastered: number;
  retaining: number;
  learning: number;
  struggling: number;
}

export interface MemoryDashboardData {
  totalWords: number;
  dueTodayCount: number;
  masteredCount: number;
  weakWordsCount: number;
  currentStreakDays: number;
  overallRetentionRate: number;
  retentionTiers: RetentionTiers;
  recentActivity: DailyReviewActivity[];
  dueWords: WordMemoryStatus[];
  weakWords: WordMemoryStatus[];
}

export interface WeakWordTip {
  wordId: string;
  word: string;
  meaning: string;
  errorCount: number;
  mnemonicTip: string;
  exampleSentence: string;
}

export interface AiMemorySuggestion {
  overallAssessment: string;
  dailyActionPlan: string;
  retentionForecast: string;
  highPriorityWords: WeakWordTip[];
  motivationalQuote: string;
}

// Document Scanner & Cambridge RAG Interfaces
export interface CambridgeWordDetails {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  cefrLevel?: string;
  englishDefinition?: string;
  vietnameseTranslation?: string;
  examples: string[];
  synonyms: string[];
  sourceUrl: string;
}

export interface ScannedWord {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  cefrLevel?: string;
  meaning: string;
  englishMeaning?: string;
  example?: string;
  context?: string;
  isSelected: boolean;
}

export interface ScanDocumentResult {
  documentName: string;
  totalExtractedWords: number;
  extractedWords: ScannedWord[];
}

export interface BatchImportResult {
  totalSubmitted: number;
  successfullyImported: number;
  importedVocabularies: Vocabulary[];
  message: string;
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("ai_riser_token")
      : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // If body is NOT FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: res.statusText }));
    throw new Error(errorData.message || "API request failed");
  }

  if (res.status === 204) return {} as T;
  return res.json();
}
