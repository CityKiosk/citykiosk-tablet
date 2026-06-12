"use client";

import { useI18n } from "./I18nProvider";

/**
 * Fetch hatası ekranı — boş durumdan ayrışır ("verilerim silindi" paniğini
 * önler) ve tek dokunuşla yeniden deneme sunar.
 */
export default function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {t.common.loadError}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer mt-4 h-11 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
      >
        {t.common.retry}
      </button>
    </div>
  );
}
