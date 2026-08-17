"use client";

import { useState, useEffect } from "react";
import {
  QuizType,
  QuizDifficulty,
  QuizQuestion,
  GeneratedQuizResponse,
  EvaluationResult,
  fetchApi,
  SyncVectorsResponse,
} from "@/lib/api";
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Volume2,
  Database,
  ArrowRight,
  Award,
  Layers,
  ChevronRight,
  RefreshCw,
  BookOpen,
  Keyboard,
  Gauge,
  HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/soundEffects";

interface QuizArenaProps {
  initialWordIds?: string[];
  onBackToHub: () => void;
}

export default function QuizArena({ initialWordIds, onBackToHub }: QuizArenaProps) {
  // Setup State
  const [selectedType, setSelectedType] = useState<QuizType | "mixed">("mixed");
  const [questionCount, setQuestionCount] = useState<number>(
    initialWordIds?.length ? Math.min(initialWordIds.length, 15) : 5
  );
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(QuizDifficulty.Medium);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSyncingVectors, setIsSyncingVectors] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; isError: boolean } | null>(null);

  // Audio Speech Speed: 0.8x, 1.0x, 1.2x
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  // Active Quiz State
  const [quizSession, setQuizSession] = useState<GeneratedQuizResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [answersHistory, setAnswersHistory] = useState<
    { question: QuizQuestion; answer: string; result: EvaluationResult }[]
  >([]);
  const [isQuizCompleted, setIsQuizCompleted] = useState<boolean>(false);
  const [showRagContext, setShowRagContext] = useState<boolean>(false);

  // Play pronunciation with chosen speed rate
  const playPronunciation = (word: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = speechRate;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!quizSession || isQuizCompleted || isEvaluating) return;

      const currentQ = quizSession.questions[currentIndex];
      if (!currentQ) return;

      // When showing result, Enter key proceeds to next question
      if (evaluationResult) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleNextQuestion();
        }
        return;
      }

      // Multiple Choice shortcuts: Keys 1, 2, 3, 4
      const isChoice =
        currentQ.type === QuizType.MultipleChoiceWordToMeaning ||
        currentQ.type === QuizType.MultipleChoiceMeaningToWord;

      if (isChoice && currentQ.options) {
        if (["1", "2", "3", "4"].includes(e.key)) {
          const optIdx = parseInt(e.key) - 1;
          if (optIdx >= 0 && optIdx < currentQ.options.length) {
            e.preventDefault();
            sounds.playClickSound();
            handleSelectOption(currentQ.options[optIdx]);
          }
        }
      } else {
        // Translation / Fill blank shortcuts: Ctrl+Enter to submit
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          if (userAnswer.trim()) {
            handleSubmitAnswer();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quizSession, currentIndex, evaluationResult, isQuizCompleted, isEvaluating, userAnswer]);

  // Sync Vectors
  const handleSyncVectors = async () => {
    sounds.playClickSound();
    setIsSyncingVectors(true);
    setSyncStatus(null);
    try {
      const res = await fetchApi<SyncVectorsResponse>("/quiz/sync-vectors", {
        method: "POST",
      });
      setSyncStatus({ message: res.message, isError: false });
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setSyncStatus({ message: err.message || "Đồng bộ Vector thất bại", isError: true });
      setTimeout(() => setSyncStatus(null), 5000);
    } finally {
      setIsSyncingVectors(false);
    }
  };

  // Generate Quiz
  const handleStartQuiz = async () => {
    sounds.playClickSound();
    setIsGenerating(true);
    setEvaluationResult(null);
    setAnswersHistory([]);
    setCurrentIndex(0);
    setIsQuizCompleted(false);
    setUserAnswer("");

    try {
      const payload = {
        quizType: selectedType === "mixed" ? null : selectedType,
        count: questionCount,
        wordIds: initialWordIds && initialWordIds.length > 0 ? initialWordIds : null,
        difficulty: difficulty,
        includeContext: true,
      };

      const res = await fetchApi<GeneratedQuizResponse>("/quiz/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.questions || res.questions.length === 0) {
        alert("Không thể tạo câu hỏi. Hãy thêm một vài từ vựng vào kho trước nhé!");
        return;
      }

      setQuizSession(res);
    } catch (err: any) {
      alert(err.message || "Tạo câu hỏi thất bại");
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit Answer
  const handleSubmitAnswer = async (forcedAnswer?: string) => {
    if (!quizSession) return;
    const currentQ = quizSession.questions[currentIndex];
    const answerToSubmit = forcedAnswer !== undefined ? forcedAnswer : userAnswer;

    if (!answerToSubmit.trim()) return;

    setIsEvaluating(true);
    try {
      const payload = {
        questionId: currentQ.id,
        wordId: currentQ.wordId,
        type: currentQ.type,
        questionPrompt: currentQ.questionPrompt,
        correctAnswer: currentQ.correctAnswer,
        userAnswer: answerToSubmit,
        sentenceContext: currentQ.sentenceContext,
      };

      const res = await fetchApi<EvaluationResult>("/quiz/evaluate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setEvaluationResult(res);
      setAnswersHistory((prev) => [
        ...prev,
        { question: currentQ, answer: answerToSubmit, result: res },
      ]);

      // Sound feedback
      if (res.isCorrect) {
        sounds.playCorrectSound();
      } else {
        sounds.playIncorrectSound();
      }
    } catch (err: any) {
      alert(err.message || "Đánh giá câu trả lời thất bại");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSelectOption = (option: string) => {
    if (isEvaluating || evaluationResult) return;
    setUserAnswer(option);
    handleSubmitAnswer(option);
  };

  const handleNextQuestion = () => {
    if (!quizSession) return;
    sounds.playClickSound();

    if (currentIndex + 1 < quizSession.questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setUserAnswer("");
      setEvaluationResult(null);
      setShowRagContext(false);
    } else {
      setIsQuizCompleted(true);
      sounds.playCelebrationSound();
    }
  };

  const currentQuestion = quizSession ? quizSession.questions[currentIndex] : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. QUIZ SETUP SCREEN (Neo-Brutalist) */}
      {!quizSession && (
        <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 sm:p-10 shadow-[6px_6px_0px_0px_#0f172a] dark:shadow-[6px_6px_0px_0px_#1e293b]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-900 dark:border-slate-700 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#86EFAC] text-slate-900 text-xs font-black rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] mb-2">
                <Sparkles className="w-3.5 h-3.5" /> AI Quiz Generator & RAG Pipeline
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Đấu Trường AI Quiz
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium mt-1">
                {initialWordIds && initialWordIds.length > 0
                  ? `Chế độ Ôn tập từ hay sai (Mistake Review) cho ${initialWordIds.length} từ vựng`
                  : "Sinh bài kiểm tra thông minh dựa trên kho từ vựng và ngữ cảnh thực tế"}
              </p>
            </div>

            {/* Vector DB Sync Action */}
            <div className="flex flex-col sm:items-end gap-2">
              <button
                type="button"
                onClick={handleSyncVectors}
                disabled={isSyncingVectors}
                className="flex items-center gap-2 px-4 py-2 bg-[#FEF08A] hover:bg-[#FDE047] text-slate-900 text-xs font-black border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] neo-btn-hover cursor-pointer disabled:opacity-50"
                title="Đồng bộ lại toàn bộ Vector Embeddings"
              >
                <Database className={`w-4 h-4 text-slate-900 ${isSyncingVectors ? "animate-spin" : ""}`} />
                {isSyncingVectors ? "Đang đồng bộ..." : "Đồng bộ Vector DB"}
              </button>

              {syncStatus && (
                <span
                  className={`text-xs font-black px-2 py-0.5 rounded-lg border border-slate-900 ${
                    syncStatus.isError ? "bg-rose-200 text-rose-900" : "bg-emerald-200 text-emerald-900"
                  }`}
                >
                  {syncStatus.message}
                </span>
              )}
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {/* Format Selection */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                1. Chọn định dạng câu hỏi
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  {
                    id: "mixed",
                    title: "Tổng hợp (Mixed)",
                    desc: "Xáo trộn ngẫu nhiên cả 4 dạng câu hỏi",
                    badge: "Khuyên dùng",
                    badgeColor: "bg-[#86EFAC]",
                  },
                  {
                    id: QuizType.MultipleChoiceWordToMeaning,
                    title: "Từ ➔ Nghĩa tiếng Việt",
                    desc: "Trắc nghiệm chọn nghĩa tiếng Việt",
                    badgeColor: "bg-[#BAE6FD]",
                  },
                  {
                    id: QuizType.MultipleChoiceMeaningToWord,
                    title: "Nghĩa ➔ Từ tiếng Anh",
                    desc: "Trắc nghiệm tìm từ vựng theo nghĩa",
                    badgeColor: "bg-[#DDD6FE]",
                  },
                  {
                    id: QuizType.FillInTheBlank,
                    title: "Điền từ vào chỗ trống",
                    desc: "Hoàn thành câu ngữ cảnh do AI tạo",
                    badgeColor: "bg-[#FEF08A]",
                  },
                  {
                    id: QuizType.EnglishToVietnamese,
                    title: "Dịch Anh ➔ Việt",
                    desc: "Luyện dịch nghĩa câu hoặc cụm từ",
                    badgeColor: "bg-[#FECDD3]",
                  },
                  {
                    id: QuizType.VietnameseToEnglish,
                    title: "Dịch Việt ➔ Anh",
                    desc: "Luyện phản xạ cấu trúc câu tiếng Anh",
                    badgeColor: "bg-[#A7F3D0]",
                  },
                ].map((format) => {
                  const isSelected = selectedType === format.id;
                  return (
                    <div
                      key={format.id}
                      onClick={() => {
                        sounds.playClickSound();
                        setSelectedType(format.id as any);
                      }}
                      className={`p-4 rounded-3xl border-2 border-slate-900 dark:border-slate-700 cursor-pointer select-none flex flex-col justify-between transition-all ${
                        isSelected
                          ? "bg-[#86EFAC] text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
                          : "bg-[#FDFBF7] dark:bg-slate-950 text-slate-800 dark:text-slate-200 shadow-[2px_2px_0px_0px_#0f172a] hover:bg-slate-100 dark:hover:bg-slate-900"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black">{format.title}</h4>
                          {format.badge && (
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full border border-slate-900 ${format.badgeColor} text-slate-900`}
                            >
                              {format.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium mt-1 opacity-80">{format.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Question Count & Difficulty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  2. Số lượng câu hỏi ({questionCount} câu)
                </label>
                <div className="flex items-center gap-2">
                  {[3, 5, 10, 15].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        sounds.playClickSound();
                        setQuestionCount(cnt);
                      }}
                      className={`flex-1 py-2.5 rounded-2xl font-black text-xs border-2 border-slate-900 transition-all cursor-pointer ${
                        questionCount === cnt
                          ? "bg-[#22C55E] text-slate-900 shadow-[3px_3px_0px_#0f172a]"
                          : "bg-[#FDFBF7] dark:bg-slate-950 text-slate-700 dark:text-slate-300 shadow-[2px_2px_0px_#0f172a] hover:bg-slate-100"
                      }`}
                    >
                      {cnt} câu
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  3. Độ khó (Difficulty)
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { level: QuizDifficulty.Easy, label: "Dễ", color: "bg-[#86EFAC]" },
                    { level: QuizDifficulty.Medium, label: "Vừa", color: "bg-[#FEF08A]" },
                    { level: QuizDifficulty.Hard, label: "Khó", color: "bg-[#FDA4AF]" },
                  ].map((d) => (
                    <button
                      key={d.level}
                      type="button"
                      onClick={() => {
                        sounds.playClickSound();
                        setDifficulty(d.level);
                      }}
                      className={`flex-1 py-2.5 rounded-2xl font-black text-xs border-2 border-slate-900 transition-all cursor-pointer ${
                        difficulty === d.level
                          ? `${d.color} text-slate-900 shadow-[3px_3px_0px_#0f172a]`
                          : "bg-[#FDFBF7] dark:bg-slate-950 text-slate-700 dark:text-slate-300 shadow-[2px_2px_0px_#0f172a] hover:bg-slate-100"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleStartQuiz}
                disabled={isGenerating}
                className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 font-black py-4 rounded-2xl border-2 border-slate-900 shadow-[5px_5px_0px_#0f172a] neo-btn-hover flex items-center justify-center gap-3 cursor-pointer text-sm uppercase tracking-wider disabled:opacity-50"
              >
                <Play className={`w-5 h-5 fill-slate-900 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "AI đang tổng hợp & sinh câu hỏi..." : "Bắt đầu AI Quiz ngay"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACTIVE QUIZ SESSION */}
      {quizSession && !isQuizCompleted && currentQuestion && (
        <div className="space-y-6">
          {/* Top Progress Bar & Controls */}
          <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-4 flex items-center justify-between shadow-[4px_4px_0px_#0f172a] dark:shadow-[4px_4px_0px_#1e293b]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-900 bg-[#86EFAC] border-2 border-slate-900 px-3 py-1 rounded-full shadow-[2px_2px_0px_#0f172a]">
                Câu {currentIndex + 1} / {quizSession.totalQuestions}
              </span>

              {/* Pronunciation Speed Selector */}
              <div className="flex items-center gap-1 bg-[#FDFBF7] dark:bg-slate-950 p-1 rounded-xl border-2 border-slate-900">
                <Gauge className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 ml-1" />
                {[0.8, 1.0, 1.2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setSpeechRate(rate)}
                    className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-colors ${
                      speechRate === rate
                        ? "bg-[#22C55E] text-slate-900 border border-slate-900"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowRagContext(!showRagContext)}
                className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] neo-btn-hover cursor-pointer ${
                  showRagContext ? "bg-[#FEF08A] text-slate-900" : "bg-[#BAE6FD] text-slate-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {showRagContext ? "Ẩn RAG Context" : "RAG Context"}
              </button>

              <button
                type="button"
                onClick={() => setQuizSession(null)}
                className="text-xs font-black text-rose-600 hover:underline cursor-pointer"
              >
                Thoát Quiz
              </button>
            </div>
          </div>

          {/* Expandable RAG Context Inspector */}
          <AnimatePresence>
            {showRagContext && currentQuestion.ragSourceContext && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-[#FEF08A] border-2 border-slate-900 rounded-3xl p-4 text-xs font-mono text-slate-900 shadow-[4px_4px_0px_#0f172a]"
              >
                <div className="flex items-center gap-1.5 font-black mb-1.5 text-slate-900">
                  <Database className="w-4 h-4" /> Nguồn Ngữ Cảnh RAG Pipeline (Vector Augmented)
                </div>
                <p className="whitespace-pre-wrap font-bold">{currentQuestion.ragSourceContext}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Question Card */}
          <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 sm:p-10 shadow-[6px_6px_0px_0px_#0f172a] dark:shadow-[6px_6px_0px_0px_#1e293b]">
            {/* Target Word Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-slate-700 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {currentQuestion.targetWord}
                </h3>
                <button
                  type="button"
                  onClick={() => playPronunciation(currentQuestion.targetWord)}
                  className="p-2 bg-[#FEF08A] text-slate-900 border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_#0f172a] neo-btn-hover cursor-pointer"
                  title="Nghe phát âm"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              <span className="text-xs font-black text-slate-600 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-900">
                {currentQuestion.targetPhonetic}
              </span>
            </div>

            {/* Prompt Instruction */}
            <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-6">
              {currentQuestion.questionPrompt}
            </p>

            {/* Contextual Example Sentence (if any) */}
            {currentQuestion.sentenceContext && (
              <div className="bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-800 rounded-2xl p-4 mb-6 text-sm font-bold text-slate-800 dark:text-slate-200 italic shadow-[2px_2px_0px_#0f172a]">
                "{currentQuestion.sentenceContext}"
              </div>
            )}

            {/* Multiple Choice Options */}
            {(currentQuestion.type === QuizType.MultipleChoiceWordToMeaning ||
              currentQuestion.type === QuizType.MultipleChoiceMeaningToWord) &&
              currentQuestion.options && (
                <div className="space-y-3">
                  <div className="text-[11px] font-black text-slate-500 flex items-center gap-1 mb-1">
                    <Keyboard className="w-3.5 h-3.5" /> Phím tắt: Bấm phím 1, 2, 3, 4 trên bàn phím để chọn
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentQuestion.options.map((opt, idx) => {
                      const isChosen = userAnswer === opt;
                      let btnStyle =
                        "bg-[#FDFBF7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-2 border-slate-900 dark:border-slate-700 shadow-[3px_3px_0px_#0f172a] hover:bg-[#FEF08A]";

                      if (evaluationResult) {
                        if (opt === evaluationResult.correctAnswer) {
                          btnStyle =
                            "bg-[#86EFAC] text-slate-900 border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] font-black";
                        } else if (isChosen && !evaluationResult.isCorrect) {
                          btnStyle =
                            "bg-[#FECDD3] text-rose-900 border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a]";
                        } else {
                          btnStyle = "opacity-40 border-2 border-slate-400";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!!evaluationResult || isEvaluating}
                          onClick={() => handleSelectOption(opt)}
                          className={`p-4 rounded-2xl text-left text-sm font-extrabold transition-all flex items-start gap-3 cursor-pointer select-none neo-btn-hover ${btnStyle}`}
                        >
                          <span className="w-6 h-6 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-900 text-xs font-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#0f172a]">
                            {idx + 1}
                          </span>
                          <span className="leading-snug">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Text Input (Translation & Fill in the Blank) */}
            {currentQuestion.type !== QuizType.MultipleChoiceWordToMeaning &&
              currentQuestion.type !== QuizType.MultipleChoiceMeaningToWord && (
                <div className="space-y-4">
                  <div className="relative">
                    <textarea
                      rows={3}
                      disabled={!!evaluationResult || isEvaluating}
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Nhập câu trả lời hoặc bản dịch của bạn... (Ctrl + Enter để nộp)"
                      className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none shadow-[3px_3px_0px_#0f172a]"
                    />
                  </div>

                  {!evaluationResult && (
                    <button
                      type="button"
                      disabled={isEvaluating || !userAnswer.trim()}
                      onClick={() => handleSubmitAnswer()}
                      className="bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 font-black px-6 py-3.5 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] neo-btn-hover text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {isEvaluating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> AI đang chấm điểm...
                        </>
                      ) : (
                        <>
                          Nộp câu trả lời <ArrowRight className="w-4 h-4 stroke-[3]" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

            {/* Evaluation Real-Time Feedback Card (Neo-Brutalist) */}
            <AnimatePresence>
              {evaluationResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-6 p-6 rounded-3xl border-2 border-slate-900 shadow-[5px_5px_0px_#0f172a] ${
                    evaluationResult.isCorrect ? "bg-[#86EFAC] text-slate-900" : "bg-[#FECDD3] text-rose-950"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {evaluationResult.isCorrect ? (
                        <CheckCircle2 className="w-6 h-6 text-slate-900 stroke-[2.5]" />
                      ) : (
                        <XCircle className="w-6 h-6 text-rose-900 stroke-[2.5]" />
                      )}
                      <span className="font-black text-base">{evaluationResult.feedback}</span>
                    </div>

                    <span className="text-xs font-black bg-white text-slate-900 px-3 py-1 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
                      Điểm: {evaluationResult.score}/100
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-bold text-slate-900">
                    <p>
                      <strong>Đáp án chính xác:</strong>{" "}
                      <span className="underline">{evaluationResult.correctAnswer}</span>
                    </p>
                    {evaluationResult.detailedExplanation && (
                      <p>
                        <strong>Giải thích AI:</strong> {evaluationResult.detailedExplanation}
                      </p>
                    )}
                    {evaluationResult.grammarBreakdown && (
                      <p>
                        <strong>Ngữ pháp:</strong> {evaluationResult.grammarBreakdown}
                      </p>
                    )}
                    {evaluationResult.usageTip && (
                      <p className="bg-white/80 p-2.5 rounded-xl border border-slate-900">
                        💡 <strong>Mẹo dùng từ:</strong> {evaluationResult.usageTip}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="bg-white hover:bg-slate-100 text-slate-900 font-black px-6 py-2.5 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] neo-btn-hover text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      {currentIndex + 1 < quizSession.questions.length ? (
                        <>
                          Câu tiếp theo (Enter) <ChevronRight className="w-4 h-4 stroke-[3]" />
                        </>
                      ) : (
                        <>
                          Xem kết quả tổng kết <Award className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 3. QUIZ SUMMARY SCREEN */}
      {isQuizCompleted && quizSession && (
        <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 sm:p-10 text-center shadow-[6px_6px_0px_#0f172a] dark:shadow-[6px_6px_0px_#1e293b]">
          <div className="w-16 h-16 bg-[#FEF08A] text-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a]">
            <Award className="w-8 h-8 stroke-[2.5]" />
          </div>

          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
            Tổng Kết Đấu Trường Quiz
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mb-6">
            Dữ liệu kết quả đã tự động đồng bộ vào hệ thống Lặp lại ngắt quãng SuperMemo-2
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-8">
            <div className="bg-[#BAE6FD] p-4 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a]">
              <span className="text-[10px] uppercase font-black text-slate-800">Tổng số câu</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {quizSession.totalQuestions}
              </p>
            </div>
            <div className="bg-[#86EFAC] p-4 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a]">
              <span className="text-[10px] uppercase font-black text-slate-800">Chính xác</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {answersHistory.filter((a) => a.result.isCorrect).length}
              </p>
            </div>
            <div className="bg-[#FEF08A] p-4 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a]">
              <span className="text-[10px] uppercase font-black text-slate-800">Điểm TB</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {answersHistory.length > 0
                  ? Math.round(
                      answersHistory.reduce((acc, curr) => acc + curr.result.score, 0) /
                        answersHistory.length
                    )
                  : 0}
              </p>
            </div>
          </div>

          {/* Detailed Question Review List */}
          <div className="text-left space-y-3 mb-8 max-w-2xl mx-auto">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Chi tiết câu trả lời:
            </h4>
            {answersHistory.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 text-xs font-bold flex items-center justify-between shadow-[2px_2px_0px_#0f172a]"
              >
                <div className="flex items-center gap-2.5">
                  {item.result.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 stroke-[2.5]" />
                  )}
                  <div>
                    <span className="text-slate-900 dark:text-white font-black">
                      {item.question.targetWord}
                    </span>
                    <span className="text-slate-500 ml-2">({item.question.questionPrompt})</span>
                  </div>
                </div>

                <span
                  className={`font-black px-2 py-0.5 rounded-lg border border-slate-900 ${
                    item.result.isCorrect ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900"
                  }`}
                >
                  {item.result.score}đ
                </span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                sounds.playClickSound();
                setQuizSession(null);
              }}
              className="px-6 py-3 rounded-2xl bg-[#BAE6FD] hover:bg-[#7DD3FC] text-slate-900 text-xs font-black border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] neo-btn-hover cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" /> Làm bài Quiz khác
            </button>
            <button
              type="button"
              onClick={onBackToHub}
              className="px-6 py-3 rounded-2xl bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 text-xs font-black border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] neo-btn-hover cursor-pointer flex items-center gap-1.5"
            >
              <BookOpen className="w-4 h-4 stroke-[2.5]" /> Về Kho từ vựng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
