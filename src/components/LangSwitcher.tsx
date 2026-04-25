"use client";

import { useI18n } from "./I18nProvider";
import { Locale } from "@/lib/types";

const langs: { code: Locale; label: string }[] = [
  { code: "tr", label: "TR" },
  { code: "de", label: "DE" },
];

export default function LangSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div
      role="group"
      aria-label="Language / Sprache"
      className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5"
    >
      {langs.map((l) => {
        const active = locale === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLocale(l.code)}
            aria-pressed={active}
            className={`cursor-pointer px-2.5 py-1 text-[11px] font-semibold rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors ${
              active
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
