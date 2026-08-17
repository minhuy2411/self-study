"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Volume2, VolumeX } from "lucide-react";
import { sounds } from "@/lib/soundEffects";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("ai_riser_theme");
    // Default to light mode (like the LearnHub educational demo) unless explicitly saved as dark
    const initialDark = savedTheme === "dark";
    setIsDark(initialDark);
    if (initialDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    setIsMuted(sounds.isSoundMuted());
  }, []);

  const toggleTheme = () => {
    sounds.playClickSound();
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("ai_riser_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("ai_riser_theme", "light");
    }
  };

  const toggleSound = () => {
    const newMuted = sounds.toggleMute();
    setIsMuted(newMuted);
    if (!newMuted) {
      sounds.playClickSound();
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2 py-1.5 rounded-2xl border-2 border-slate-900 dark:border-slate-700 shadow-[3px_3px_0px_0px_#0f172a] dark:shadow-[3px_3px_0px_0px_#1e293b] transition-all">
      {/* Sound Toggle */}
      <button
        type="button"
        onClick={toggleSound}
        className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-800 dark:text-slate-200"
        title={isMuted ? "Bật âm thanh (Sound On)" : "Tắt âm thanh (Mute Sound)"}
        aria-label="Toggle Sound"
      >
        {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
      </button>

      <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700" />

      {/* Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-800 dark:text-slate-200"
        title={isDark ? "Chuyển sang Chế độ Sáng (Light Mode)" : "Chuyển sang Chế độ Tối (Dark Mode)"}
        aria-label="Toggle Dark/Light Mode"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600" />
        )}
      </button>
    </div>
  );
}
