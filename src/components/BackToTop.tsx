"use client";

import { useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";
import { ArrowUpIcon } from "./icons";

export default function BackToTop() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label={t.catalog.backToTop}
      tabIndex={visible ? 0 : -1}
      className={`cursor-pointer fixed right-5 z-40 w-11 h-11 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
    >
      <ArrowUpIcon width={18} height={18} />
    </button>
  );
}
