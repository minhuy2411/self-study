"use client";

import { useState, useRef } from "react";
import {
  fetchApi,
  ScannedWord,
  ScanDocumentResult,
  BatchImportResult,
} from "@/lib/api";
import {
  FileText,
  UploadCloud,
  Sparkles,
  Check,
  X,
  Volume2,
  BookOpen,
  ArrowRight,
  RotateCw,
  Layers,
  Database,
  CheckCircle2,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/soundEffects";

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function DocumentScannerModal({
  isOpen,
  onClose,
  onImportSuccess,
}: DocumentScannerModalProps) {
  const [activeMode, setActiveMode] = useState<"file" | "text">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatusMsg, setScanStatusMsg] = useState<string>("");

  // Scan Results
  const [scanResult, setScanResult] = useState<ScanDocumentResult | null>(null);
  const [extractedWords, setExtractedWords] = useState<ScannedWord[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResultMsg, setImportResultMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      sounds.playClickSound();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      sounds.playClickSound();
    }
  };

  const playPronunciation = (word: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleStartScan = async () => {
    if (activeMode === "file" && !selectedFile) {
      alert("Vui lòng chọn một tệp PDF hoặc tài liệu văn bản.");
      return;
    }
    if (activeMode === "text" && !pastedText.trim()) {
      alert("Vui lòng dán nội dung văn bản cần quét.");
      return;
    }

    sounds.playClickSound();
    setIsScanning(true);
    setScanResult(null);
    setImportResultMsg(null);
    setScanStatusMsg("Đang phân tích cấu trúc tài liệu & trích xuất từ vựng...");

    try {
      let res: ScanDocumentResult;

      if (activeMode === "file" && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        setScanStatusMsg("Đang đọc PDF và tra cứu Cambridge Dictionary RAG...");
        res = await fetchApi<ScanDocumentResult>("/vocabularies/scan-document", {
          method: "POST",
          body: formData,
        });
      } else {
        setScanStatusMsg("Đang phân tích văn bản và tra cứu Cambridge Dictionary RAG...");
        res = await fetchApi<ScanDocumentResult>("/vocabularies/scan-text", {
          method: "POST",
          body: JSON.stringify({ rawText: pastedText }),
        });
      }

      if (!res.extractedWords || res.extractedWords.length === 0) {
        alert("Không tìm thấy từ vựng nào trong tài liệu. Hãy thử với tệp hoặc đoạn văn bản khác.");
        return;
      }

      setScanResult(res);
      setExtractedWords(res.extractedWords.map((w) => ({ ...w, isSelected: true })));
      sounds.playCorrectSound();
    } catch (err: any) {
      alert(err.message || "Quét tài liệu thất bại");
      sounds.playIncorrectSound();
    } finally {
      setIsScanning(false);
      setScanStatusMsg("");
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    sounds.playClickSound();
    setExtractedWords((prev) => prev.map((w) => ({ ...w, isSelected: checked })));
  };

  const toggleSelectWord = (index: number) => {
    sounds.playClickSound();
    setExtractedWords((prev) =>
      prev.map((w, idx) => (idx === index ? { ...w, isSelected: !w.isSelected } : w))
    );
  };

  const handleWordChange = (index: number, field: keyof ScannedWord, value: string) => {
    setExtractedWords((prev) =>
      prev.map((w, idx) => (idx === index ? { ...w, [field]: value } : w))
    );
  };

  const handleBatchImport = async () => {
    const selected = extractedWords.filter((w) => w.isSelected);
    if (selected.length === 0) {
      alert("Vui lòng chọn ít nhất 1 từ vựng để nhập.");
      return;
    }

    sounds.playClickSound();
    setIsImporting(true);
    try {
      const res = await fetchApi<BatchImportResult>("/vocabularies/batch-import", {
        method: "POST",
        body: JSON.stringify({ words: selected }),
      });

      setImportResultMsg(res.message);
      sounds.playCelebrationSound();

      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Nhập từ vựng thất bại");
      sounds.playIncorrectSound();
    } finally {
      setIsImporting(false);
    }
  };

  const selectedCount = extractedWords.filter((w) => w.isSelected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#131B2E] border-3 border-slate-900 dark:border-slate-700 rounded-3xl p-6 sm:p-8 w-full max-w-4xl shadow-[8px_8px_0px_0px_#0f172a] dark:shadow-[8px_8px_0px_0px_#1e293b] max-h-[90vh] flex flex-col justify-between my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-slate-700 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#86EFAC] text-slate-900 border-2 border-slate-900 rounded-2xl flex items-center justify-center shadow-[2px_2px_0px_#0f172a]">
              <FileText className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Quét Văn Bản / PDF AI & Cambridge RAG
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">
                Tự động phát hiện từ vựng, tra cứu Cambridge Dictionary và xuất câu ví dụ ngữ cảnh
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-[#FECDD3] hover:bg-[#FDA4AF] text-rose-900 border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_#0f172a] transition-all cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-6">
          {/* STEP 1: Upload / Input Mode Switcher */}
          {!scanResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-[#FDFBF7] dark:bg-slate-950 p-1.5 rounded-2xl border-2 border-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClickSound();
                    setActiveMode("file");
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeMode === "file"
                      ? "bg-[#22C55E] text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  Tải lên tệp PDF / Tài liệu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClickSound();
                    setActiveMode("text");
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeMode === "text"
                      ? "bg-[#BAE6FD] text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  Dán đoạn văn bản (Paste Text)
                </button>
              </div>

              {activeMode === "file" ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-3 border-dashed border-slate-900 dark:border-slate-700 hover:border-emerald-500 rounded-3xl p-8 sm:p-12 text-center bg-[#FDFBF7] dark:bg-slate-950/60 cursor-pointer transition-all shadow-[4px_4px_0px_#0f172a] group select-none"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf,.txt,.docx,.doc"
                    className="hidden"
                  />
                  <div className="w-16 h-16 bg-[#BAE6FD] text-slate-900 border-2 border-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-[3px_3px_0px_#0f172a] group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-8 h-8 stroke-[2.5]" />
                  </div>

                  {selectedFile ? (
                    <div>
                      <p className="text-base font-black text-slate-900 dark:text-white">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB - Bấm để chọn tệp khác
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-base font-black text-slate-900 dark:text-white">
                        Kéo thả tệp PDF vào đây hoặc bấm để chọn tệp
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                        Hỗ trợ PDF danh sách từ vựng IELTS, TOEIC, bài đọc báo, đề thi...
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                    Dán văn bản tiếng Anh chứa từ vựng:
                  </label>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Dán bài báo, đoạn văn bản IELTS hoặc danh sách từ vựng vào đây..."
                    className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none shadow-[3px_3px_0px_#0f172a]"
                  />
                </div>
              )}

              {/* Scan Trigger Button */}
              <button
                type="button"
                onClick={handleStartScan}
                disabled={isScanning}
                className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 font-black py-4 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] neo-btn-hover flex items-center justify-center gap-3 cursor-pointer text-sm uppercase tracking-wider disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <RotateCw className="w-5 h-5 animate-spin" /> {scanStatusMsg}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 stroke-[2.5]" /> Bắt đầu quét & Tra cứu Cambridge RAG
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: Interactive Scanned Words Review Table */}
          {scanResult && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#BAE6FD] border-2 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_#0f172a]">
                <div>
                  <h4 className="font-black text-sm text-slate-900">
                    Đã tìm thấy {extractedWords.length} từ vựng từ {scanResult.documentName}
                  </h4>
                  <p className="text-xs font-bold text-slate-700">
                    Đã tra cứu định nghĩa Cambridge Dictionary & ngữ cảnh tự động
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(selectedCount !== extractedWords.length)}
                    className="text-xs font-black px-3 py-1.5 bg-white border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_#0f172a] cursor-pointer"
                  >
                    {selectedCount === extractedWords.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>

                  <span className="text-xs font-black bg-[#22C55E] text-slate-900 px-3 py-1.5 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
                    Đã chọn: {selectedCount}/{extractedWords.length}
                  </span>
                </div>
              </div>

              {/* Scanned Words Table */}
              <div className="overflow-x-auto border-2 border-slate-900 dark:border-slate-700 rounded-2xl shadow-[3px_3px_0px_#0f172a]">
                <table className="w-full text-left text-xs bg-white dark:bg-[#131B2E]">
                  <thead>
                    <tr className="border-b-2 border-slate-900 dark:border-slate-700 bg-[#FEF08A] text-slate-900 font-black uppercase tracking-wider">
                      <th className="p-3 text-center w-10">#</th>
                      <th className="p-3">Từ vựng (Word)</th>
                      <th className="p-3">Loại từ & CEFR</th>
                      <th className="p-3">Nghĩa tiếng Việt</th>
                      <th className="p-3">Định nghĩa tiếng Anh (Cambridge)</th>
                      <th className="p-3">Ví dụ (Example)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-200 dark:divide-slate-800 text-slate-900 dark:text-slate-200 font-bold">
                    {extractedWords.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          item.isSelected
                            ? "bg-[#FDFBF7] dark:bg-slate-950/60"
                            : "opacity-40 bg-slate-100 dark:bg-slate-900"
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.isSelected}
                            onChange={() => toggleSelectWord(idx)}
                            className="w-4 h-4 rounded border-2 border-slate-900 accent-emerald-600 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {item.word}
                            </span>
                            <button
                              type="button"
                              onClick={() => playPronunciation(item.word)}
                              className="p-1 bg-[#FEF08A] text-slate-900 border border-slate-900 rounded-lg cursor-pointer"
                              title="Nghe phát âm"
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>
                          </div>
                          {item.phonetic && (
                            <span className="text-[10px] text-slate-500 font-mono block">
                              {item.phonetic}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {item.partOfSpeech && (
                              <span className="px-2 py-0.5 rounded-lg bg-[#DDD6FE] text-slate-900 border border-slate-900 text-[10px] font-black uppercase">
                                {item.partOfSpeech}
                              </span>
                            )}
                            {item.cefrLevel && (
                              <span className="px-2 py-0.5 rounded-lg bg-[#86EFAC] text-slate-900 border border-slate-900 text-[10px] font-black">
                                {item.cefrLevel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.meaning}
                            onChange={(e) => handleWordChange(idx, "meaning", e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-900 dark:border-slate-700 rounded-xl px-2 py-1 text-xs font-bold"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.englishMeaning || ""}
                            onChange={(e) => handleWordChange(idx, "englishMeaning", e.target.value)}
                            placeholder="Cambridge English definition..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-900 dark:border-slate-700 rounded-xl px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.example || ""}
                            onChange={(e) => handleWordChange(idx, "example", e.target.value)}
                            placeholder="Example sentence..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-900 dark:border-slate-700 rounded-xl px-2 py-1 text-xs font-medium italic"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Feedback Success */}
              {importResultMsg && (
                <div className="p-4 rounded-2xl bg-[#86EFAC] text-slate-900 border-2 border-slate-900 font-black text-sm shadow-[3px_3px_0px_#0f172a] flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  {importResultMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-4 border-t-2 border-slate-900 dark:border-slate-700 flex items-center justify-between">
          {scanResult ? (
            <button
              type="button"
              onClick={() => {
                sounds.playClickSound();
                setScanResult(null);
              }}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-black rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] text-xs cursor-pointer"
            >
              Quét tệp khác
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-black text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Hủy
            </button>

            {scanResult && (
              <button
                type="button"
                onClick={handleBatchImport}
                disabled={isImporting || selectedCount === 0}
                className="bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 font-black px-6 py-3 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] neo-btn-hover text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" /> Đang nhập & Tạo Vector...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 stroke-[2.5]" /> Nhập {selectedCount} từ vào Kho & Sinh Vector
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
