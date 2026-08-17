"use client";

import { useState, useEffect } from "react";
import {
  fetchApi,
  MemoryDashboardData,
  WordMemoryStatus,
  SrsReviewResult,
  AiMemorySuggestion,
} from "@/lib/api";
import {
  Flame,
  Clock,
  Brain,
  Award,
  RotateCw,
  Sparkles,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Gamepad2,
  BookOpen,
  Calendar,
  Layers,
  ChevronRight,
  Lightbulb,
  Zap,
  Keyboard,
  Gauge,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/soundEffects";

interface MemoryDashboardProps {
  isActive?: boolean;
  onStartQuizWithWords?: (wordIds: string[]) => void;
  onBackToHub: () => void;
}

export default function MemoryDashboard({
  isActive = true,
  onStartQuizWithWords,
  onBackToHub,
}: MemoryDashboardProps) {
  const [data, setData] = useState<MemoryDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // AI Suggestions
  const [aiSuggestions, setAiSuggestions] = useState<AiMemorySuggestion | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);

  // Audio Speech Speed
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  // Flashcard Mode
  const [activeDueWordIndex, setActiveDueWordIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);
  const [reviewResult, setReviewResult] = useState<SrsReviewResult | null>(null);

  useEffect(() => {
    if (isActive) {
      loadDashboardData();
    }
  }, [isActive]);

  // Keyboard Shortcuts for Flashcard Player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!data || data.dueWords.length === 0 || submittingRating) return;

      // Space to Flip Card
      if (e.code === "Space") {
        e.preventDefault();
        sounds.playFlipSound();
        setIsFlipped((prev) => !prev);
        return;
      }

      // When flipped, keys 1, 2, 3, 4 map to SM-2 ratings
      if (isFlipped) {
        if (e.key === "1") {
          e.preventDefault();
          handleSrsRating(0);
        } else if (e.key === "2") {
          e.preventDefault();
          handleSrsRating(2);
        } else if (e.key === "3") {
          e.preventDefault();
          handleSrsRating(4);
        } else if (e.key === "4") {
          e.preventDefault();
          handleSrsRating(5);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [data, isFlipped, submittingRating, activeDueWordIndex]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<MemoryDashboardData>("/memory/dashboard");
      setData(res);
      setActiveDueWordIndex(0);
      setIsFlipped(false);
    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu tiến độ trí nhớ");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAiSuggestions = async () => {
    sounds.playClickSound();
    setLoadingAi(true);
    try {
      const res = await fetchApi<AiMemorySuggestion>("/memory/suggestions");
      setAiSuggestions(res);
    } catch (err: any) {
      alert(err.message || "Không thể tải lời khuyên từ Memory AI Coach");
    } finally {
      setLoadingAi(false);
    }
  };

  const playPronunciation = (word: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = speechRate;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSrsRating = async (qualityRating: number) => {
    if (!data || data.dueWords.length === 0) return;
    const currentWord = data.dueWords[activeDueWordIndex];
    if (!currentWord) return;

    sounds.playClickSound();
    setSubmittingRating(true);
    try {
      const res = await fetchApi<SrsReviewResult>("/memory/review", {
        method: "POST",
        body: JSON.stringify({
          wordId: currentWord.wordId,
          qualityRating: qualityRating,
          reviewSource: "Flashcard",
        }),
      });

      setReviewResult(res);

      if (qualityRating >= 3) {
        sounds.playCorrectSound();
      } else {
        sounds.playIncorrectSound();
      }

      setTimeout(() => {
        setReviewResult(null);
        setIsFlipped(false);
        if (activeDueWordIndex + 1 < data.dueWords.length) {
          setActiveDueWordIndex((prev) => prev + 1);
        } else {
          // Finished all due words, reload dashboard and play celebration
          sounds.playCelebrationSound();
          loadDashboardData();
        }
      }, 1200);
    } catch (err: any) {
      alert(err.message || "Đánh giá SM-2 thất bại");
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-600 dark:text-slate-400 flex flex-col items-center justify-center gap-3 font-bold">
        <RotateCw className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm">Đang tải phân tích đường cong quên & tiến độ trí nhớ...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-8 max-w-2xl mx-auto shadow-[6px_6px_0px_#0f172a]">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3 stroke-[2.5]" />
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Không thể tải dữ liệu</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-4">{error}</p>
        <button
          type="button"
          onClick={loadDashboardData}
          className="px-6 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 font-black rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] text-xs transition-all cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const currentFlashcard = data.dueWords[activeDueWordIndex];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header (Neo-Brutalist) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#DDD6FE] text-slate-900 text-xs font-black rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] mb-2">
            <Brain className="w-3.5 h-3.5" /> Spaced Repetition System (SuperMemo-2)
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Tiến Độ & Trí Nhớ AI
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium mt-1">
            Theo dõi đường cong quên Ebbinghaus và tối ưu lịch ôn tập ngắt quãng thông minh
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              sounds.playClickSound();
              loadDashboardData();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white dark:bg-[#131B2E] hover:bg-slate-100 text-slate-900 dark:text-white text-xs font-black border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] neo-btn-hover cursor-pointer disabled:opacity-50"
            title="Làm mới tiến độ trí nhớ"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleFetchAiSuggestions}
            disabled={loadingAi}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#FEF08A] hover:bg-[#FDE047] text-slate-900 text-xs font-black border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] neo-btn-hover cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-slate-900 ${loadingAi ? "animate-spin" : ""}`} />
            {loadingAi ? "AI đang phân tích..." : "Nhận lời khuyên từ Memory AI Coach"}
          </button>
        </div>
      </div>

      {/* 1. Top Key Metric Cards (Pastel Neo-Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#FEF08A] border-2 border-slate-900 rounded-3xl p-5 shadow-[4px_4px_0px_0px_#0f172a] neo-btn-hover"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Chuỗi Streak
            </span>
            <div className="w-9 h-9 rounded-xl bg-white border-2 border-slate-900 text-amber-500 flex items-center justify-center shadow-[1px_1px_0px_#0f172a]">
              <Flame className="w-5 h-5 fill-amber-500" />
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 mt-2 flex items-baseline gap-1">
            {data.currentStreakDays} <span className="text-xs font-bold text-slate-700">ngày</span>
          </div>
          <p className="text-[11px] text-slate-800 mt-1 flex items-center gap-1 font-bold">
            <Zap className="w-3.5 h-3.5" /> Duy trì thói quen mỗi ngày
          </p>
        </motion.div>

        {/* Due Today */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#BAE6FD] border-2 border-slate-900 rounded-3xl p-5 shadow-[4px_4px_0px_0px_#0f172a] neo-btn-hover"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Cần ôn hôm nay
            </span>
            <div className="w-9 h-9 rounded-xl bg-white border-2 border-slate-900 text-cyan-600 flex items-center justify-center shadow-[1px_1px_0px_#0f172a]">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 mt-2 flex items-baseline gap-1">
            {data.dueTodayCount} <span className="text-xs font-bold text-slate-700">từ vựng</span>
          </div>
          <p className="text-[11px] text-slate-800 mt-1 font-bold">
            Chuẩn SM-2 tính theo đường cong quên
          </p>
        </motion.div>

        {/* Overall Retention Rate */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#86EFAC] border-2 border-slate-900 rounded-3xl p-5 shadow-[4px_4px_0px_0px_#0f172a] neo-btn-hover"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Độ bền trí nhớ
            </span>
            <div className="w-9 h-9 rounded-xl bg-white border-2 border-slate-900 text-emerald-600 flex items-center justify-center shadow-[1px_1px_0px_#0f172a]">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 mt-2">
            {data.overallRetentionRate}%
          </div>
          <p className="text-[11px] text-slate-800 mt-1 font-bold">
            Ebbinghaus Retention Index
          </p>
        </motion.div>

        {/* Mastered Words */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#DDD6FE] border-2 border-slate-900 rounded-3xl p-5 shadow-[4px_4px_0px_0px_#0f172a] neo-btn-hover"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Đã thành thạo
            </span>
            <div className="w-9 h-9 rounded-xl bg-white border-2 border-slate-900 text-purple-600 flex items-center justify-center shadow-[1px_1px_0px_#0f172a]">
              <Award className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 mt-2 flex items-baseline gap-1">
            {data.masteredCount} <span className="text-xs font-bold text-slate-700">/ {data.totalWords} từ</span>
          </div>
          <p className="text-[11px] text-slate-800 mt-1 font-bold">
            Đã nhớ trên 4 lần lặp lại
          </p>
        </motion.div>
      </div>

      {/* 2. Memory AI Coach Card (Neo-Brutalist) */}
      <AnimatePresence>
        {aiSuggestions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#0f172a] dark:shadow-[6px_6px_0px_0px_#1e293b]"
          >
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-white text-sm font-black uppercase tracking-wider mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Lời Khuyên Từ Memory AI Coach
            </div>

            <p className="text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-relaxed mb-4 font-bold">
              {aiSuggestions.overallAssessment}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
              <div className="bg-[#BAE6FD] border-2 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_#0f172a]">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> Kế hoạch học tập hôm nay:
                </span>
                <p className="text-xs font-bold text-slate-800 whitespace-pre-line leading-relaxed">
                  {aiSuggestions.dailyActionPlan}
                </p>
              </div>

              <div className="bg-[#FEF08A] border-2 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_#0f172a]">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 stroke-[2.5]" /> Dự báo độ bền trí nhớ (14 ngày):
                </span>
                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                  {aiSuggestions.retentionForecast}
                </p>
              </div>
            </div>

            {aiSuggestions.highPriorityWords && aiSuggestions.highPriorityWords.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-slate-900 dark:border-slate-700">
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block mb-2">
                  💡 Mẹo ghi nhớ (Mnemonics) cho các từ cần chú ý:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aiSuggestions.highPriorityWords.map((w, idx) => (
                    <div
                      key={idx}
                      className="bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 rounded-2xl p-3.5 text-xs shadow-[2px_2px_0px_#0f172a]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-sm text-slate-900 dark:text-white">{w.word}</span>
                        <span className="text-slate-600 dark:text-slate-400 font-bold">({w.meaning})</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-300 font-medium italic">{w.mnemonicTip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiSuggestions.motivationalQuote && (
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-4 italic text-center">
                {aiSuggestions.motivationalQuote}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. SM-2 Flashcard Quick Review & Retention Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: SM-2 Interactive Flashcard Player (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-600 stroke-[2.5]" />
              Ôn Tập Nhanh SM-2 Flashcard
            </h3>

            <div className="flex items-center gap-3">
              {/* Pronunciation Speed Selector */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#131B2E] p-1.5 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
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

              {data.dueWords.length > 0 && (
                <span className="text-xs font-black text-slate-900 dark:text-white bg-[#86EFAC] px-3 py-1 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
                  {activeDueWordIndex + 1} / {data.dueWords.length} thẻ
                </span>
              )}
            </div>
          </div>

          {data.totalWords === 0 ? (
            <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-8 text-center shadow-[5px_5px_0px_#0f172a]">
              <div className="w-14 h-14 bg-[#DDD6FE] text-purple-950 border-2 border-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_#0f172a]">
                <BookOpen className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">
                Chưa có từ vựng nào trong kho
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-1 max-w-md mx-auto">
                Hãy thêm từ vựng mới hoặc quét tài liệu PDF để bắt đầu theo dõi tiến độ trí nhớ theo đường cong quên Ebbinghaus!
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onBackToHub}
                  className="px-6 py-3 rounded-2xl bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 text-xs font-black border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] neo-btn-hover transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 inline mr-1 stroke-[2.5]" /> Thêm từ mới ngay
                </button>
              </div>
            </div>
          ) : data.dueWords.length === 0 ? (
            <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-8 text-center shadow-[5px_5px_0px_#0f172a]">
              <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto mb-3 stroke-[2.5]" />
              <h4 className="text-xl font-black text-slate-900 dark:text-white">
                Đã hoàn thành ôn tập hôm nay! 🎉
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-1 max-w-md mx-auto">
                Tất cả {data.totalWords} từ vựng trong kho hiện chưa đến hạn ôn tập theo đường cong quên. Bạn có thể luyện bài Quiz nâng cao hoặc thêm từ mới.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onBackToHub}
                  className="px-6 py-3 rounded-2xl bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 text-xs font-black border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] neo-btn-hover transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 inline mr-1 stroke-[2.5]" /> Thêm từ mới
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Interactive Flashcard (Neo-Brutalist) */}
              <div
                onClick={() => {
                  sounds.playFlipSound();
                  setIsFlipped(!isFlipped);
                }}
                className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-8 min-h-[280px] flex flex-col justify-between cursor-pointer transition-all shadow-[6px_6px_0px_0px_#0f172a] dark:shadow-[6px_6px_0px_0px_#1e293b] select-none neo-btn-hover"
              >
                {/* Status Pill */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border-2 border-slate-900 shadow-[1px_1px_0px_#0f172a] ${
                      currentFlashcard?.retentionStatus === "Struggling"
                        ? "bg-[#FECDD3] text-rose-950"
                        : currentFlashcard?.retentionStatus === "Mastered"
                        ? "bg-[#DDD6FE] text-purple-950"
                        : "bg-[#BAE6FD] text-cyan-950"
                    }`}
                  >
                    {currentFlashcard?.retentionStatus || "Learning"}
                  </span>

                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 bg-[#FEF08A] px-2.5 py-0.5 rounded-full border border-slate-900">
                    <Keyboard className="w-3.5 h-3.5" /> [Space] để {isFlipped ? "xem từ" : "lật thẻ"} 🔄
                  </span>
                </div>

                {/* Card Content */}
                <div className="text-center my-6">
                  {!isFlipped ? (
                    <div>
                      <div className="flex items-center justify-center gap-3">
                        <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                          {currentFlashcard?.word}
                        </h2>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (currentFlashcard?.word) playPronunciation(currentFlashcard.word);
                          }}
                          className="p-2 bg-[#FEF08A] text-slate-900 border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_#0f172a] neo-btn-hover cursor-pointer"
                          title="Nghe phát âm"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                      {currentFlashcard?.phonetic && (
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 font-mono mt-1">
                          {currentFlashcard.phonetic}
                        </p>
                      )}
                      {currentFlashcard?.partOfSpeech && (
                        <span className="text-xs font-black text-indigo-700 dark:text-indigo-400 block mt-1">
                          ({currentFlashcard.partOfSpeech})
                        </span>
                      )}
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                        {currentFlashcard?.meaning}
                      </h3>
                      {currentFlashcard?.example && (
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-bold italic bg-[#FDFBF7] dark:bg-slate-950 p-3.5 rounded-2xl border-2 border-slate-900 mt-4 max-w-md mx-auto shadow-[2px_2px_0px_#0f172a]">
                          "{currentFlashcard.example}"
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Card Footer Info */}
                <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300 border-t-2 border-slate-900 dark:border-slate-700 pt-3">
                  <span>Lặp lại: {currentFlashcard?.repetitionCount || 0} lần</span>
                  <span>Độ dễ (EF): {currentFlashcard?.easeFactor || 2.5}</span>
                  <span>Giãn cách: {currentFlashcard?.interval || 0} ngày</span>
                </div>
              </div>

              {/* SM-2 Rating Buttons (Shown when flipped) */}
              <AnimatePresence>
                {isFlipped && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-4 bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-5 shadow-[5px_5px_0px_#0f172a]"
                  >
                    <div className="text-center text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                      Đánh giá độ nhớ SuperMemo-2 (Bấm phím 1 - 4):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSrsRating(0)}
                        disabled={submittingRating}
                        className="p-3.5 rounded-2xl bg-[#FECDD3] text-rose-950 border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] text-left neo-btn-hover cursor-pointer"
                      >
                        <div className="font-black text-xs">[1] Quên hoàn toàn</div>
                        <div className="text-[10px] font-bold opacity-80 mt-0.5">Ôn lại ngày mai</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSrsRating(2)}
                        disabled={submittingRating}
                        className="p-3.5 rounded-2xl bg-[#FEF08A] text-amber-950 border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] text-left neo-btn-hover cursor-pointer"
                      >
                        <div className="font-black text-xs">[2] Khó nhớ</div>
                        <div className="text-[10px] font-bold opacity-80 mt-0.5">Nhắc lại sớm (1d)</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSrsRating(4)}
                        disabled={submittingRating}
                        className="p-3.5 rounded-2xl bg-[#BAE6FD] text-cyan-950 border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] text-left neo-btn-hover cursor-pointer"
                      >
                        <div className="font-black text-xs">[3] Nhớ tốt</div>
                        <div className="text-[10px] font-bold opacity-80 mt-0.5">Kéo dài giãn cách</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSrsRating(5)}
                        disabled={submittingRating}
                        className="p-3.5 rounded-2xl bg-[#86EFAC] text-emerald-950 border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] text-left neo-btn-hover cursor-pointer"
                      >
                        <div className="font-black text-xs">[4] Rất dễ</div>
                        <div className="text-[10px] font-bold opacity-80 mt-0.5">Tăng tối đa khoảng cách</div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* SM-2 Real-Time Feedback Banner */}
              {reviewResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-[#86EFAC] rounded-3xl p-6 flex flex-col items-center justify-center text-center z-20 border-3 border-slate-900 shadow-[8px_8px_0px_#0f172a]"
                >
                  <CheckCircle2 className="w-12 h-12 text-slate-900 mb-2 stroke-[2.5]" />
                  <h4 className="font-black text-base text-slate-900">{reviewResult.feedbackMessage}</h4>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    Lần ôn tiếp theo: Giãn cách <strong>{reviewResult.interval} ngày</strong> (EF: {reviewResult.easeFactor})
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Right: Retention Curve & Activity Charts (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Retention Tiers Distribution */}
          <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 shadow-[5px_5px_0px_#0f172a] dark:shadow-[5px_5px_0px_#1e293b]">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" /> Phân Bố Độ Bền Trí Nhớ
            </h3>

            <div className="space-y-3">
              {[
                {
                  label: "Thành thạo (Mastered)",
                  count: data.retentionTiers.mastered,
                  color: "bg-[#22C55E]",
                  textColor: "text-emerald-700 dark:text-emerald-400",
                },
                {
                  label: "Đang ghi nhớ (Retaining)",
                  count: data.retentionTiers.retaining,
                  color: "bg-[#38BDF8]",
                  textColor: "text-sky-700 dark:text-sky-400",
                },
                {
                  label: "Đang học (Learning)",
                  count: data.retentionTiers.learning,
                  color: "bg-[#FACC15]",
                  textColor: "text-amber-700 dark:text-amber-400",
                },
                {
                  label: "Hay quên / Từ yếu (Struggling)",
                  count: data.retentionTiers.struggling,
                  color: "bg-[#F87171]",
                  textColor: "text-rose-700 dark:text-rose-400",
                },
              ].map((tier, idx) => {
                const percent = data.totalWords > 0 ? (tier.count / data.totalWords) * 100 : 0;
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-xs font-black mb-1">
                      <span className={tier.textColor}>{tier.label}</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {tier.count} từ ({Math.round(percent)}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#FDFBF7] dark:bg-slate-950 h-3 rounded-full overflow-hidden border-2 border-slate-900">
                      <div
                        className={`h-full ${tier.color} transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7-Day Activity Chart */}
          <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 shadow-[5px_5px_0px_#0f172a] dark:shadow-[5px_5px_0px_#1e293b]">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-600 stroke-[2.5]" /> Hoạt Động Ôn Tập 7 Ngày Qua
            </h3>

            <div className="grid grid-cols-7 gap-2 items-end h-28 pt-2">
              {data.recentActivity.map((day, idx) => {
                const maxCount = Math.max(1, ...data.recentActivity.map((d) => d.reviewCount));
                const barHeight = (day.reviewCount / maxCount) * 100;
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                      {day.reviewCount}
                    </span>
                    <div className="w-full bg-[#FDFBF7] dark:bg-slate-950 rounded-t-xl h-20 flex items-end p-0.5 border-2 border-slate-900 overflow-hidden">
                      <div
                        className="w-full bg-[#22C55E] rounded-sm transition-all duration-500 border-t border-slate-900"
                        style={{ height: `${Math.max(barHeight, day.reviewCount > 0 ? 20 : 0)}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {day.dayOfWeek}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Weak Words Logger & Mistake Review Mode (Neo-Brutalist) */}
      <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_#0f172a] dark:shadow-[6px_6px_0px_#1e293b]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-rose-500 stroke-[2.5]" />
              Danh Sách Từ Hay Sai (Weak Words Logger)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-0.5">
              Hệ thống tự động phát hiện các từ có tỉ lệ lỗi cao để kích hoạt chế độ ôn tập chuyên sâu
            </p>
          </div>

          {data.weakWords.length > 0 && onStartQuizWithWords && (
            <button
              type="button"
              onClick={() => onStartQuizWithWords(data.weakWords.map((w) => w.wordId))}
              className="flex items-center gap-2 bg-[#FDA4AF] hover:bg-[#F43F5E] text-slate-900 font-black px-5 py-3 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] neo-btn-hover text-xs transition-all cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4 stroke-[2.5]" />
              Ôn tập {data.weakWords.length} từ hay sai ngay
            </button>
          )}
        </div>

        {data.weakWords.length === 0 ? (
          <div className="text-center py-10 bg-[#86EFAC] rounded-3xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a]">
            <CheckCircle2 className="w-10 h-10 text-slate-900 mx-auto mb-2 stroke-[2.5]" />
            <p className="text-slate-900 text-sm font-black">
              Tuyệt vời! Không có từ nào bị xếp vào nhóm từ yếu.
            </p>
            <p className="text-xs text-slate-800 font-bold mt-0.5">Hãy tiếp tục duy trì phong độ nhé!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 dark:border-slate-700 text-slate-900 dark:text-white font-black uppercase tracking-wider">
                  <th className="pb-3">Từ vựng</th>
                  <th className="pb-3">Nghĩa tiếng Việt</th>
                  <th className="pb-3 text-center">Số lần sai</th>
                  <th className="pb-3 text-center">Độ bền trí nhớ</th>
                  <th className="pb-3 text-right">Lần ôn tiếp theo</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-200 dark:divide-slate-800 text-slate-900 dark:text-slate-200 font-bold">
                {data.weakWords.map((w) => (
                  <tr key={w.wordId} className="hover:bg-[#FDFBF7] dark:hover:bg-slate-900 transition-colors">
                    <td className="py-3 font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      {w.word}
                      <button
                        type="button"
                        onClick={() => playPronunciation(w.word)}
                        className="p-1 bg-[#FEF08A] text-slate-900 border border-slate-900 rounded-lg"
                        title="Nghe phát âm"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="py-3">{w.meaning}</td>
                    <td className="py-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FECDD3] text-rose-950 border border-slate-900 font-black">
                        {w.errorCount} lỗi
                      </span>
                    </td>
                    <td className="py-3 text-center font-mono font-black">
                      {Math.round(w.retentionScore * 100)}%
                    </td>
                    <td className="py-3 text-right font-mono font-black">
                      {new Date(w.nextReviewDate).toLocaleDateString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
