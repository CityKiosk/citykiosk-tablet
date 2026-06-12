"use client";

import { useActionState } from "react";
import { requestPasswordReset, type RequestResetState } from "./actions";

const initialState: RequestResetState = {};

export function RequestResetForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);

  if (state.success) {
    return (
      <div
        role="status"
        className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
      >
        <p className="font-medium">E-Mail wurde versendet.</p>
        <p className="mt-1">
          Bitte prüfen Sie Ihren Posteingang (und ggf. Spam-Ordner) für den Link zum
          Zurücksetzen.
        </p>
        <p className="mt-2 text-xs opacity-80">
          E-posta gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={state?.fieldErrors?.email ? "true" : undefined}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {state?.fieldErrors?.email ? (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
      >
        {isPending ? "Wird gesendet..." : "Link senden"}
      </button>
    </form>
  );
}
