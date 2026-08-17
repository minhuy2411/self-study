"use client";

import { useState, useEffect } from "react";
import { fetchApi, Vocabulary, CambridgeWordDetails } from "@/lib/api";
import {
  Plus,
  Search,
  BookOpen,
  Sparkles,
  Volume2,
  Trash2,
  LogOut,
  Gamepad2,
  Brain,
  Gauge,
  Layers,
  ArrowRight,
  Flame,
  CheckCircle2,
  GraduationCap,
  FileText,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QuizArena from "@/components/QuizArena";
import MemoryDashboard from "@/components/MemoryDashboard";
import ThemeToggle from "@/components/ThemeToggle";
import DocumentScannerModal from "@/components/DocumentScannerModal";
import VocabularyDetailModal from "@/components/VocabularyDetailModal";
import { sounds } from "@/lib/soundEffects";

export default function Home() {
  const [isAuth, setIsAuth] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  // Active Tab: "vocab" | "quiz" | "memory"
  const [activeTab, setActiveTab] = useState<"vocab" | "quiz" | "memory">("vocab");
  const [quizWordIds, setQuizWordIds] = useState<string[] | undefined>(undefined);

  // Audio Speech Speed
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  // Form auth
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");

  // Vocab State
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [selectedVocab, setSelectedVocab] = useState<Vocabulary | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Add Vocab Modal/Form
  const [isAdding, setIsAdding] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [newEnglishMeaning, setNewEnglishMeaning] = useState("");
  const [newCefrLevel, setNewCefrLevel] = useState("");
  const [newPhonetic, setNewPhonetic] = useState("");
  const [newPartOfSpeech, setNewPartOfSpeech] = useState("");
  const [newExample, setNewExample] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  // Document Scanner Modal
  const [isScanningDoc, setIsScanningDoc] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("ai_riser_token");
    const savedUser = localStorage.getItem("ai_riser_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setIsAuth(true);
    }
  }, []);

  useEffect(() => {
    if (isAuth) {
      loadVocabularies();
    }
  }, [isAuth, search]);

  const loadVocabularies = async () => {
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await fetchApi<Vocabulary[]>(`/vocabularies${query}`);
      setVocabularies(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = isLoginMode ? "/auth/login" : "/auth/register";
    const payload = isLoginMode ? { email, password } : { email, password, name };

    try {
      const res: any = await fetchApi(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      sounds.playCelebrationSound();
      localStorage.setItem("ai_riser_token", res.token);
      localStorage.setItem(
        "ai_riser_user",
        JSON.stringify({ email: res.email, name: res.name })
      );
      setToken(res.token);
      setUser({ email: res.email, name: res.name });
      setIsAuth(true);
    } catch (err: any) {
      setAuthError(err.message || "Xác thực thất bại");
      sounds.playIncorrectSound();
    }
  };

  const handleLogout = () => {
    sounds.playClickSound();
    localStorage.removeItem("ai_riser_token");
    localStorage.removeItem("ai_riser_user");
    setToken(null);
    setUser(null);
    setIsAuth(false);
  };

  const handleLookupDictionary = async () => {
    if (!newWord.trim()) return;
    sounds.playClickSound();
    setLookupLoading(true);
    try {
      // First try Cambridge Dictionary RAG
      const cambridgeData: CambridgeWordDetails = await fetchApi(
        `/vocabularies/cambridge/${encodeURIComponent(newWord.trim())}`
      );

      if (cambridgeData) {
        if (cambridgeData.phonetic) setNewPhonetic(cambridgeData.phonetic);
        if (cambridgeData.partOfSpeech) setNewPartOfSpeech(cambridgeData.partOfSpeech);
        if (cambridgeData.cefrLevel) setNewCefrLevel(cambridgeData.cefrLevel);
        if (cambridgeData.englishDefinition) setNewEnglishMeaning(cambridgeData.englishDefinition);
        if (cambridgeData.vietnameseTranslation) setNewMeaning(cambridgeData.vietnameseTranslation);
        if (cambridgeData.examples && cambridgeData.examples.length > 0) {
          setNewExample(cambridgeData.examples[0]);
        }
        sounds.playCorrectSound();
      }
    } catch (err) {
      console.warn("Lookup failed or word not found");
    } finally {
      setLookupLoading(false);
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

  const handleCreateVocab = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi<Vocabulary>("/vocabularies", {
        method: "POST",
        body: JSON.stringify({
          word: newWord,
          meaning: newMeaning,
          englishMeaning: newEnglishMeaning,
          cefrLevel: newCefrLevel,
          phonetic: newPhonetic,
          partOfSpeech: newPartOfSpeech,
          example: newExample,
        }),
      });

      sounds.playCorrectSound();
      setNewWord("");
      setNewMeaning("");
      setNewEnglishMeaning("");
      setNewCefrLevel("");
      setNewPhonetic("");
      setNewPartOfSpeech("");
      setNewExample("");
      setIsAdding(false);
      loadVocabularies();
    } catch (err: any) {
      alert(err.message || "Không thể tạo từ vựng");
      sounds.playIncorrectSound();
    }
  };

  const handleDeleteVocab = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa từ này?")) return;
    sounds.playClickSound();
    try {
      await fetchApi(`/vocabularies/${id}`, { method: "DELETE" });
      loadVocabularies();
    } catch (err) {
      alert("Xóa không thành công");
    }
  };

  const handleStartMistakeQuiz = (wordIds: string[]) => {
    sounds.playClickSound();
    setQuizWordIds(wordIds);
    setActiveTab("quiz");
  };

  // Auth Screen
  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-8 shadow-[6px_6px_0px_0px_#0f172a] dark:shadow-[6px_6px_0px_0px_#1e293b] relative">
          <div className="absolute top-5 right-5">
            <ThemeToggle />
          </div>

          <div className="text-center mb-8 mt-2">
            <div className="w-14 h-14 bg-[#FDA4AF] border-2 border-slate-900 text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[3px_3px_0px_0px_#0f172a]">
              <BookOpen className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              AI-Riser
            </h1>
            <div className="inline-block mt-2 px-3 py-1 bg-[#86EFAC] text-slate-900 text-xs font-black rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
              AI-Powered RAG & Memory Platform
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginMode && (
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Họ & Tên
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-bold focus:outline-none shadow-[2px_2px_0px_#0f172a]"
                  placeholder="Nguyễn Văn A"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-bold focus:outline-none shadow-[2px_2px_0px_#0f172a]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-bold focus:outline-none shadow-[2px_2px_0px_#0f172a]"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/50 p-2 rounded-xl border border-rose-300">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 font-black py-3.5 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] neo-btn-hover cursor-pointer text-sm uppercase tracking-wider"
            >
              {isLoginMode ? "Đăng nhập ngay" : "Tạo tài khoản miễn phí"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400 font-bold">
            {isLoginMode ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <button
              type="button"
              onClick={() => {
                sounds.playClickSound();
                setIsLoginMode(!isLoginMode);
              }}
              className="text-emerald-600 dark:text-emerald-400 font-black underline cursor-pointer"
            >
              {isLoginMode ? "Đăng ký tài khoản" : "Đăng nhập ngay"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 transition-colors pb-16">
      {/* Floating Pill Navbar (Neo-Brutalist LearnHub Style) */}
      <header className="sticky top-4 z-40 px-4 max-w-6xl mx-auto">
        <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-3 px-5 shadow-[4px_4px_0px_0px_#0f172a] dark:shadow-[4px_4px_0px_0px_#1e293b] flex items-center justify-between transition-all">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div
              onClick={() => setActiveTab("vocab")}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <div className="w-10 h-10 bg-[#FDA4AF] border-2 border-slate-900 text-slate-900 rounded-xl flex items-center justify-center shadow-[2px_2px_0px_#0f172a]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-black text-xl text-slate-900 dark:text-white tracking-tight">
                  AI-Riser
                </span>
              </div>
            </div>

            {/* Desktop Navigation Pills */}
            <nav className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  sounds.playClickSound();
                  setActiveTab("vocab");
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border-2 ${
                  activeTab === "vocab"
                    ? "bg-[#22C55E] text-slate-900 border-slate-900 shadow-[3px_3px_0px_#0f172a]"
                    : "bg-transparent text-slate-700 dark:text-slate-300 border-transparent hover:border-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Kho Từ Vựng
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClickSound();
                  setActiveTab("quiz");
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border-2 flex items-center gap-1.5 ${
                  activeTab === "quiz"
                    ? "bg-[#BAE6FD] text-slate-900 border-slate-900 shadow-[3px_3px_0px_#0f172a]"
                    : "bg-transparent text-slate-700 dark:text-slate-300 border-transparent hover:border-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Gamepad2 className="w-4 h-4" /> Đấu Trường Quiz
                <span className="text-[10px] bg-[#86EFAC] text-slate-900 border border-slate-900 px-1.5 rounded-full font-black">
                  RAG
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClickSound();
                  setActiveTab("memory");
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border-2 flex items-center gap-1.5 ${
                  activeTab === "memory"
                    ? "bg-[#DDD6FE] text-slate-900 border-slate-900 shadow-[3px_3px_0px_#0f172a]"
                    : "bg-transparent text-slate-700 dark:text-slate-300 border-transparent hover:border-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Brain className="w-4 h-4" /> Trí Nhớ & Tiến Độ
                <span className="text-[10px] bg-[#FEF08A] text-slate-900 border border-slate-900 px-1.5 rounded-full font-black">
                  SRS
                </span>
              </button>
            </nav>
          </div>

          {/* Right Profile & Switchers */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            <div className="hidden sm:flex items-center gap-2 bg-[#FEF08A] text-slate-900 px-3.5 py-1.5 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
              <span className="text-xs font-black">{user?.name || "Học viên"}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 bg-[#FECDD3] hover:bg-[#FDA4AF] text-rose-900 border-2 border-slate-900 rounded-2xl shadow-[2px_2px_0px_#0f172a] transition-all cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 mt-8">
        {/* Tab 1: VOCABULARY HUB (LearnHub Hero & Cards Style) */}
        <div className={activeTab === "vocab" ? "block space-y-8" : "hidden"}>
          {/* Hero Section */}
          <div className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 sm:p-10 shadow-[6px_6px_0px_0px_#0f172a] dark:shadow-[6px_6px_0px_0px_#1e293b] flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#86EFAC] text-slate-900 text-xs font-black rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
                <Sparkles className="w-3.5 h-3.5" /> Cambridge Dictionary RAG & Smart Scanner
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Học từ vựng, <br />
                <span className="text-[#10B981] dark:text-[#34D399]">Mọi lúc, Mọi nơi!</span>
              </h1>

              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-relaxed">
                Hệ thống ghi nhớ từ vựng thông minh kết hợp RAG Cambridge Dictionary, quét tự động văn bản/PDF và tối ưu đường cong quên SuperMemo-2.
              </p>

              {/* Hero CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClickSound();
                    setIsScanningDoc(true);
                  }}
                  className="bg-[#FEF08A] hover:bg-[#FDE047] text-slate-900 font-black px-6 py-3 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] neo-btn-hover cursor-pointer text-sm flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 stroke-[2.5]" /> Quét Văn Bản / PDF AI
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playClickSound();
                    setIsAdding(true);
                  }}
                  className="bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 font-black px-6 py-3 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] neo-btn-hover cursor-pointer text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Thêm từ mới
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playClickSound();
                    setActiveTab("quiz");
                  }}
                  className="bg-[#BAE6FD] hover:bg-[#7DD3FC] text-slate-900 font-black px-6 py-3 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] neo-btn-hover cursor-pointer text-sm flex items-center gap-2"
                >
                  <Gamepad2 className="w-4 h-4 stroke-[2.5]" /> Luyện tập Quiz
                </button>
              </div>
            </div>

            {/* Mini Preview Widget */}
            <div className="w-full md:w-80 bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-5 shadow-[4px_4px_0px_#0f172a] relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#DDD6FE] border-2 border-slate-900 flex items-center justify-center font-bold text-xs">
                    📖
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">Kho Từ Vựng</h4>
                    <p className="text-[10px] text-slate-500 font-bold">{vocabularies.length} từ đã lưu</p>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-400">
                  Active
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 p-3 rounded-2xl shadow-[2px_2px_0px_#0f172a] mb-3">
                <div className="flex justify-between text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  <span>Tiến độ ghi nhớ</span>
                  <span>85%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full border border-slate-900 overflow-hidden">
                  <div className="bg-[#22C55E] h-full w-[85%]" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sounds.playClickSound();
                  setActiveTab("memory");
                }}
                className="w-full bg-[#FEF08A] hover:bg-[#FDE047] text-slate-900 font-black py-2.5 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] neo-btn-hover cursor-pointer text-xs flex items-center justify-center gap-1.5"
              >
                <Brain className="w-4 h-4" /> Xem biểu đồ trí nhớ (SRS)
              </button>
            </div>
          </div>

          {/* Search & Reading Speed Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-500 stroke-[2.5]" />
              <input
                type="text"
                placeholder="Tìm kiếm từ vựng, nghĩa tiếng Việt hoặc định nghĩa Cambridge..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-2xl pl-12 pr-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-bold focus:outline-none shadow-[3px_3px_0px_0px_#0f172a] dark:shadow-[3px_3px_0px_0px_#1e293b]"
              />
            </div>

            {/* Speech Speed Pill */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#131B2E] p-2 rounded-2xl border-2 border-slate-900 dark:border-slate-700 shadow-[3px_3px_0px_0px_#0f172a] dark:shadow-[3px_3px_0px_0px_#1e293b] self-end sm:self-auto">
              <Gauge className="w-4 h-4 text-slate-700 dark:text-slate-300 ml-1" />
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 mr-1">
                Tốc độ:
              </span>
              {[0.8, 1.0, 1.2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    sounds.playClickSound();
                    setSpeechRate(rate);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-black cursor-pointer transition-all border-2 ${
                    speechRate === rate
                      ? "bg-[#22C55E] text-slate-900 border-slate-900 shadow-[1px_1px_0px_#0f172a]"
                      : "bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Vocab Cards Grid */}
          {loading ? (
            <div className="text-center py-16 text-slate-600 dark:text-slate-400 font-bold">
              Đang tải danh sách từ vựng...
            </div>
          ) : vocabularies.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-8 shadow-[4px_4px_0px_#0f172a]">
              <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-900 dark:text-white font-black text-lg">Chưa có từ vựng nào</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                Bấm "Quét Văn Bản / PDF AI" để tải tệp PDF hoặc "Thêm từ mới" để lưu từ vựng đầu tiên
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {vocabularies.map((v) => (
                <motion.div
                  key={v.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    sounds.playClickSound();
                    setSelectedVocab(v);
                  }}
                  className="bg-white dark:bg-[#131B2E] border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 shadow-[5px_5px_0px_0px_#0f172a] dark:shadow-[5px_5px_0px_0px_#1e293b] neo-btn-hover flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight hover:underline">
                            {v.word}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playPronunciation(v.word);
                            }}
                            className="p-1.5 bg-[#FEF08A] text-slate-900 hover:bg-[#FDE047] border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_#0f172a] transition-all cursor-pointer"
                            title="Nghe phát âm"
                            aria-label="Play pronunciation"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {v.phonetic && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold mt-1">
                            {v.phonetic}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {v.partOfSpeech && (
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-[#DDD6FE] text-slate-900 border-2 border-slate-900 shadow-[1px_1px_0px_#0f172a]">
                            {v.partOfSpeech}
                          </span>
                        )}
                        {v.cefrLevel && (
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-[#86EFAC] text-slate-900 border-2 border-slate-900 shadow-[1px_1px_0px_#0f172a]">
                            {v.cefrLevel}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVocab(v.id);
                          }}
                          className="p-1 bg-[#FECDD3] hover:bg-[#FDA4AF] text-rose-900 border-2 border-slate-900 rounded-xl shadow-[1px_1px_0px_#0f172a] transition-all cursor-pointer"
                          title="Xóa từ"
                          aria-label="Delete vocabulary"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Vietnamese Meaning */}
                    <p className="text-base font-black text-slate-900 dark:text-slate-100 mt-3 leading-snug">
                      {v.meaning}
                    </p>

                    {/* Cambridge English Definition (RAG) */}
                    {v.englishMeaning && (
                      <div className="mt-3 p-3 rounded-2xl bg-[#FDFBF7] dark:bg-slate-950 border border-slate-900 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold shadow-[2px_2px_0px_#0f172a]">
                        <div className="flex items-center gap-1 font-black text-[10px] uppercase text-indigo-700 dark:text-indigo-400 mb-1">
                          <Globe className="w-3 h-3" /> Cambridge Definition:
                        </div>
                        {v.englishMeaning}
                      </div>
                    )}
                  </div>

                  {v.example && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium italic bg-[#FDFBF7] dark:bg-slate-950 p-3 rounded-2xl border-2 border-slate-900 dark:border-slate-800 mt-4 shadow-[2px_2px_0px_#0f172a]">
                      "{v.example}"
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Tab 2: AI QUIZ ARENA (Phase 2) - Kept mounted to preserve ongoing quiz state */}
        <div className={activeTab === "quiz" ? "block" : "hidden"}>
          <QuizArena
            initialWordIds={quizWordIds}
            onBackToHub={() => {
              sounds.playClickSound();
              setActiveTab("vocab");
            }}
          />
        </div>

        {/* Tab 3: MEMORY AI & SPACED REPETITION DASHBOARD (Phase 3) - Kept mounted */}
        <div className={activeTab === "memory" ? "block" : "hidden"}>
          <MemoryDashboard
            isActive={activeTab === "memory"}
            onStartQuizWithWords={handleStartMistakeQuiz}
            onBackToHub={() => {
              sounds.playClickSound();
              setActiveTab("vocab");
            }}
          />
        </div>
      </main>

      {/* Modal 1: Smart Document & PDF Scanner Modal */}
      <DocumentScannerModal
        isOpen={isScanningDoc}
        onClose={() => setIsScanningDoc(false)}
        onImportSuccess={() => {
          loadVocabularies();
        }}
      />

      {/* Modal 2: Add Word (Neo-Brutalist Popup) */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#131B2E] border-3 border-slate-900 dark:border-slate-700 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-[8px_8px_0px_0px_#0f172a] dark:shadow-[8px_8px_0px_0px_#1e293b] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-slate-700 pb-4 mb-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Thêm từ vựng mới
                </h3>
                <span className="text-xs font-black px-2.5 py-1 bg-[#86EFAC] text-slate-900 rounded-full border-2 border-slate-900">
                  Cambridge RAG Sync
                </span>
              </div>

              <form onSubmit={handleCreateVocab} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Từ tiếng Anh *
                    </label>
                    <button
                      type="button"
                      onClick={handleLookupDictionary}
                      disabled={lookupLoading}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-black cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {lookupLoading ? "Đang tra Cambridge..." : "Auto Cambridge RAG"}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-bold focus:outline-none shadow-[2px_2px_0px_#0f172a]"
                    placeholder="ví dụ: resilient"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                      Phiên âm
                    </label>
                    <input
                      type="text"
                      value={newPhonetic}
                      onChange={(e) => setNewPhonetic(e.target.value)}
                      className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none shadow-[2px_2px_0px_#0f172a]"
                      placeholder="/rɪˈzɪl.jənt/"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                      Loại từ
                    </label>
                    <select
                      value={newPartOfSpeech}
                      onChange={(e) => setNewPartOfSpeech(e.target.value)}
                      className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-2 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none shadow-[2px_2px_0px_#0f172a] cursor-pointer"
                    >
                      <option value="">-- Loại từ --</option>
                      <option value="noun">Noun</option>
                      <option value="verb">Verb</option>
                      <option value="adjective">Adjective</option>
                      <option value="adverb">Adverb</option>
                      <option value="phrase">Phrase</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                      CEFR Level
                    </label>
                    <select
                      value={newCefrLevel}
                      onChange={(e) => setNewCefrLevel(e.target.value)}
                      className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-2 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none shadow-[2px_2px_0px_#0f172a] cursor-pointer"
                    >
                      <option value="">-- CEFR --</option>
                      <option value="A1">A1</option>
                      <option value="A2">A2</option>
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="C1">C1</option>
                      <option value="C2">C2</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                    Nghĩa Tiếng Việt *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMeaning}
                    onChange={(e) => setNewMeaning(e.target.value)}
                    className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-bold focus:outline-none shadow-[2px_2px_0px_#0f172a]"
                    placeholder="kiên cường, có khả năng phục hồi nhanh"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                    Định nghĩa Tiếng Anh (Cambridge Definition)
                  </label>
                  <textarea
                    rows={2}
                    value={newEnglishMeaning}
                    onChange={(e) => setNewEnglishMeaning(e.target.value)}
                    className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none shadow-[2px_2px_0px_#0f172a]"
                    placeholder="able to be happy, successful, etc. again after something difficult or bad has happened..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                    Ví dụ ngữ cảnh (Example)
                  </label>
                  <textarea
                    rows={2}
                    value={newExample}
                    onChange={(e) => setNewExample(e.target.value)}
                    className="w-full bg-[#FDFBF7] dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-medium italic focus:outline-none shadow-[2px_2px_0px_#0f172a]"
                    placeholder="She is a resilient woman who has overcome many hardships."
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-900 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClickSound();
                      setIsAdding(false);
                    }}
                    className="px-5 py-2.5 text-sm font-black text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="bg-[#22C55E] hover:bg-[#16A34A] text-slate-900 font-black px-6 py-2.5 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_#0f172a] neo-btn-hover text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Lưu từ vựng
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: Vocabulary Detail Modal */}
      <VocabularyDetailModal
        vocab={selectedVocab}
        isOpen={!!selectedVocab}
        onClose={() => setSelectedVocab(null)}
        onDeleteVocab={handleDeleteVocab}
        onPracticeQuiz={handleStartMistakeQuiz}
        speechRate={speechRate}
      />
    </div>
  );
}
