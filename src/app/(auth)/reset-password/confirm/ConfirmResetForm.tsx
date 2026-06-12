"use client";

import { useActionState } from "react";
import { confirmPasswordReset, type ConfirmResetState } from "./actions";

const initialState: ConfirmResetState = {};

export function ConfirmResetForm() {
  const [state, formAction, isPending] = useActionState(confirmPasswordReset, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Neues Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-invalid={state?.fieldErrors?.password ? "true" : undefined}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {state?.fieldErrors?.password ? (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="confirm"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Passwort bestätigen
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={state?.fieldErrors?.confirm ? "true" : undefined}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {state?.fieldErrors?.confirm ? (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {state.fieldErrors.confirm[0]}
          </p>
        ) : null}
      </div>

      {state?.error ? (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
        >
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
      >
        {isPending ? "Wird gespeichert..." : "Passwort aktualisieren"}
      </button>
    </form>
  );
}
