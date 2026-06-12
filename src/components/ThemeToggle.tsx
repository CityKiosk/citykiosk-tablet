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
  const [, setTheme] = useState<Theme>("system");
  // isDark state'te tutulur — render sırasında DOM okumak (classList.contains)
  // concurrent render'da tutarsız aria-label üretebiliyordu.
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) || "system";
    setTheme(saved);
    apply(saved);
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) as Theme) === "system") {
        apply("system");
        setIsDark(document.documentElement.classList.contains("dark"));
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = isDark ? "light" : "dark";
    setTheme(next);
    setIsDark(next === "dark");
    localStorage.setItem(KEY, next);
    apply(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Helles Design" : "Dunkles Design"}
      suppressHydrationWarning
      className="cursor-pointer w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
    >
      {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <MoonIcon />}
    </button>
  );
}
