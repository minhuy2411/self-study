"use client";

import { Vocabulary } from "@/lib/api";
import {
  X,
  Volume2,
  BookOpen,
  Globe,
  Trash2,
  Gamepad2,
  Calendar,
  Sparkles,
  Layers,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/soundEffects";

interface VocabularyDetailModalProps {
  vocab: Vocabulary | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteVocab?: (id: string) => void;
  onPracticeQuiz?: (wordIds: string[]) => void;
  speechRate?: number;
}

export default function VocabularyDetailModal({
  vocab,
  isOpen,
  onClose,
  onDeleteVocab,
  onPracticeQuiz,
  speechRate = 1.0,
}: VocabularyDetailModalProps) {
  if (!isOpen || !vocab) return null;

  const playPronunciation = (word: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = speechRate;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getPartOfSpeechColor = (pos?: string) => {
    switch (pos?.toLowerCase()) {
      case "noun":
        return "bg-[#DDD6FE] text-purple-950";
      case "verb":
        return "bg-[#BAE6FD] text-cyan-950";
      case "adjective":
        return "bg-[#86EFAC] text-emerald-950";
      case "adverb":
        return "bg-[#FEF08A] text-amber-950";
      case "phrase":
        return "bg-[#FDA4AF] text-rose-950";
      default:
        return "bg-slate-200 text-slate-900";
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-[#131B2E] border-3 border-slate-900 dark:border-slate-700 rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-[8px_8px_0px_0px_#0f172a] dark:shadow-[8px_8px_0px_0px_#1e293b] max-h-[90vh] overflow-y-auto space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-slate-700 pb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#86EFAC] text-slate-900 text-xs font-black rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
              <BookOpen className="w-3.5 h-3.5" /> Chi Tiết Từ Vựng
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playClickSound();
                onClose();
              }}
              className="p-1.5 bg-[#FECDD3] hover:bg-[#FDA4AF] text-rose-950 border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_#0f172a] neo-btn-hover cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* Main Word Header Card */}
          <div className="bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 shadow-[4px_4px_0px_#0f172a]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                    {vocab.word}
                  </h2>
                  <button
                    type="button"
                    onClick={() => playPronunciation(vocab.word)}
                    className="p-2 bg-[#FEF08A] hover:bg-[#FDE047] text-slate-900 border-2 border-slate-900 rounded-2xl shadow-[2px_2px_0px_#0f172a] neo-btn-hover cursor-pointer"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {vocab.phonetic && (
                  <p className="text-sm font-mono font-bold text-slate-600 dark:text-slate-400 mt-1.5">
                    {vocab.phonetic}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {vocab.partOfSpeech && (
                  <span
                    className={`text-xs font-black uppercase px-3 py-1 rounded-xl border-2 border-slate-900 shadow-[1px_1px_0px_#0f172a] ${getPartOfSpeechColor(
                      vocab.partOfSpeech
                    )}`}
                  >
                    {vocab.partOfSpeech}
                  </span>
                )}
                {vocab.cefrLevel && (
                  <span className="text-xs font-black uppercase px-3 py-1 rounded-xl bg-[#86EFAC] text-slate-900 border-2 border-slate-900 shadow-[1px_1px_0px_#0f172a]">
                    {vocab.cefrLevel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Vietnamese Meaning Box */}
          <div className="bg-[#BAE6FD] border-2 border-slate-900 rounded-2xl p-5 shadow-[4px_4px_0px_#0f172a]">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 stroke-[2.5]" /> Nghĩa Tiếng Việt:
            </span>
            <p className="text-base sm:text-lg font-black text-slate-900 leading-snug">
              {vocab.meaning}
            </p>
          </div>

          {/* Cambridge English Definition */}
          {vocab.englishMeaning && (
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-2xl p-5 shadow-[4px_4px_0px_#0f172a]">
              <span className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Globe className="w-4 h-4 stroke-[2.5]" /> Cambridge English Definition (RAG):
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                {vocab.englishMeaning}
              </p>
            </div>
          )}

          {/* Example Sentence */}
          {vocab.example && (
            <div className="bg-[#FEF08A] border-2 border-slate-900 rounded-2xl p-5 shadow-[4px_4px_0px_#0f172a]">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Layers className="w-4 h-4 stroke-[2.5]" /> Câu Ví Dụ Ngữ Cảnh:
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 italic leading-relaxed">
                "{vocab.example}"
              </p>
            </div>
          )}

          {/* Custom Notes / Context */}
          {vocab.customNotes && (
            <div className="bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-800 rounded-2xl p-4 shadow-[3px_3px_0px_#0f172a]">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Ghi chú / Ngữ cảnh tài liệu:
              </span>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {vocab.customNotes}
              </p>
            </div>
          )}

          {/* Metadata Footer */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 border-t-2 border-slate-900 dark:border-slate-700 pt-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Ngày thêm:{" "}
              {vocab.createdAt ? new Date(vocab.createdAt).toLocaleDateString("vi-VN") : "Hôm nay"}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {onDeleteVocab && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClickSound();
                  onDeleteVocab(vocab.id);
                  onClose();
                }}
                className="px-4 py-2.5 bg-[#FECDD3] hover:bg-[#FDA4AF] text-rose-950 text-xs font-black border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] neo-btn-hover cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" /> Xóa từ này
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {onPracticeQuiz && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClickSound();
                    onPracticeQuiz([vocab.id]);
                    onClose();
                  }}
                  className="px-5 py-2.5 bg-[#BAE6FD] hover:bg-[#7DD3FC] text-slate-900 text-xs font-black border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] neo-btn-hover cursor-pointer flex items-center gap-1.5"
                >
                  <Gamepad2 className="w-4 h-4 stroke-[2.5]" /> Luyện Quiz từ này
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  sounds.playClickSound();
                  onClose();
                }}
                className="px-5 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 text-xs font-black border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] neo-btn-hover cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
