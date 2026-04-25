"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[souvenir]", error);
  }, [error]);

  return (
    <div className="bg-white dark:bg-stone-900 rounded-xl border border-red-200 dark:border-red-900 p-10 text-center">
      <div className="text-5xl mb-4" aria-hidden="true">
        ⚠️
      </div>
      <h1 className="text-2xl font-bold mb-2">Bir şeyler ters gitti / Etwas ist schiefgelaufen</h1>
      <p className="text-stone-600 dark:text-stone-400 mb-6 max-w-md mx-auto">
        Uygulamada beklenmedik bir hata oluştu. Sayfayı yenilemeyi deneyin.
        <br />
        Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie, die Seite neu zu laden.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Tekrar dene / Erneut versuchen
        </button>
      </div>
    </div>
  );
}
