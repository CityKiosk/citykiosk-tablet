"use client";

// Route-level error boundary — bir sayfa render'da patlarsa tüm uygulamayı
// global-error'a düşürmek yerine shell içinde kurtarılabilir bir ekran göster.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useI18n } from "@/components/I18nProvider";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        {t.common.errorTitle}
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
        {t.common.errorBody}
      </p>
      <button
        type="button"
        onClick={reset}
        className="cursor-pointer mt-6 h-11 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
      >
        {t.common.retry}
      </button>
    </div>
  );
}
