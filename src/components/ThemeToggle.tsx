"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

const KEY = "souvenir_theme";
type Theme = "light" | "dark" | "system";

function apply(theme: Theme) {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) || "system";
    setTheme(saved);
    apply(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) as Theme) === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const isDark = document.documentElement.classList.contains("dark");
    const next: Theme = isDark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(KEY, next);
    apply(next);
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Before mount, render a neutral placeholder to avoid hydration mismatch
  const isDark = mounted && document.documentElement.classList.contains("dark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      suppressHydrationWarning
      className="cursor-pointer w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
    >
      {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <MoonIcon />}
    </button>
  );
}
