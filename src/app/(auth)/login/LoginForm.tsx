"use client";

// ============================================================================
// LoginForm — Client Component
// ============================================================================
// Uses useActionState (React 19) for progressive form state.
// Progressive slowdown: after 3 failed attempts, button is disabled for 2s.
// After 5, disabled for 10s. Light UI throttle for extra brute-force friction.
// ============================================================================

import { useActionState, useEffect, useState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const [failCount, setFailCount] = useState(0);
  const [throttleUntil, setThrottleUntil] = useState(0);
  const [throttleRemaining, setThrottleRemaining] = useState(0);

  // Track failed attempts → increment counter on each error
  useEffect(() => {
    if (state?.error || state?.fieldErrors) {
      setFailCount((c) => {
        const next = c + 1;
        if (next >= 5) {
          setThrottleUntil(Date.now() + 10_000);
        } else if (next >= 3) {
          setThrottleUntil(Date.now() + 2_000);
        }
        return next;
      });
    }
  }, [state]);

  // Throttle countdown display
  useEffect(() => {
    if (throttleUntil <= Date.now()) {
      setThrottleRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, throttleUntil - Date.now());
      setThrottleRemaining(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setThrottleRemaining(0);
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [throttleUntil]);

  const isThrottled = throttleRemaining > 0;
  const disabled = isPending || isThrottled;

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

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
          aria-describedby={state?.fieldErrors?.email ? "email-error" : undefined}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {state?.fieldErrors?.email ? (
          <p id="email-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Passwort · Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state?.fieldErrors?.password ? "true" : undefined}
          aria-describedby={state?.fieldErrors?.password ? "password-error" : undefined}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {state?.fieldErrors?.password ? (
          <p id="password-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {state.fieldErrors.password[0]}
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
        disabled={disabled}
        className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
      >
        {isPending
          ? "Anmeldung läuft..."
          : isThrottled
            ? `Bitte warten (${throttleRemaining}s)`
            : "Anmelden · Giriş"}
      </button>
    </form>
  );
}
