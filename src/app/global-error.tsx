"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body className="flex items-center justify-center min-h-dvh bg-slate-50 text-slate-900">
        <div className="text-center px-6">
          <h1 className="text-2xl font-semibold mb-2">Etwas ist schiefgelaufen</h1>
          <p className="text-sm text-slate-500 mb-6">
            Ein unerwarteter Fehler ist aufgetreten.
          </p>
          <button
            type="button"
            onClick={reset}
            className="h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800"
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
