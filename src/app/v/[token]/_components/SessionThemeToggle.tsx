"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@/components/icons";

// Per-session dark/light toggle for public catalog views.
// Does NOT persist — overrides only for this tab. Customers who haven't
// toggled keep their OS preference (theme-init.js handles initial paint).
export default function SessionThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (!mounted) return null;

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setIsDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Helles Design" : "Dunkles Design"}
      className={
        className ??
        "w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
      }
    >
      {isDark ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
    </button>
  );
}
