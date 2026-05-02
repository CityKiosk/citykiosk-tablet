"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { LockIcon } from "@/components/icons";
import PinPad from "@/components/PinPad";
import {
  getPinStatus,
  hasPin as hasPinAction,
  setPin as setPinAction,
  verifyPin,
  type PinErrorCode,
  type PinHashScope,
} from "@/app/(dashboard)/settings/actions";
import type { PinScope } from "@/lib/pinSession";

type Mode = "loading" | "loadError" | "unlock" | "setupNew" | "setupConfirm";

type Props = {
  unlockTitle: string;
  /** Called after a successful unlock. The parent renders the protected
   * content; sessionStorage flag is also written. */
  onUnlocked: () => void;
  /** sessionStorage key used to mark this tab as unlocked. */
  sessionKey: string;
  /** Server-side scope for the unlock. Each gated screen passes its own
   *  scope so unlocking one (e.g. /settings) does not implicitly unlock
   *  another (e.g. /stock). */
  scope: PinScope;
  /** Optional sub-heading shown under the title — used by /stock to tell
   *  the user the admin PIN is also accepted as fallback. Only rendered
   *  when `fallbackHintScope`'s scope-specific hash is NOT set; once the
   *  user sets a Lager-PIN the admin PIN no longer unlocks /stock and
   *  the hint becomes a lie. */
  fallbackHint?: string;
  /** Which scope's hash existence determines whether the fallback hint
   *  is shown. Independent of the unlock scope so hint logic can be
   *  decoupled from auth flow. */
  fallbackHintScope?: PinHashScope;
};

function pinErrorMessage(
  code: PinErrorCode,
  t: ReturnType<typeof useI18n>["t"],
): string {
  switch (code) {
    case "wrong_pin":
      return t.pin.incorrect;
    case "rate_limited":
      return t.pin.tooManyAttempts;
    case "mismatch":
      return t.pin.mismatch;
    case "invalid_format":
      return t.pin.incorrect;
    case "unauthenticated":
    case "internal":
    default:
      return t.pin.saveError;
  }
}

export default function PinGate({
  unlockTitle,
  onUnlocked,
  sessionKey,
  scope,
  fallbackHint,
  fallbackHintScope,
}: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [probe, setProbe] = useState(0);
  // Whether the fallback hint should appear. Tri-state: null = still
  // loading (hide), true = scope hash NOT set so admin PIN still works,
  // false = scope hash set so admin PIN no longer works for this scope.
  const [showFallbackHint, setShowFallbackHint] = useState<boolean | null>(null);

  // Always require fresh PIN entry on each admin page visit. Threat model:
  // owner hands the tablet to a customer; customer must NOT be able to walk
  // into /settings or /orders just because the owner unlocked recently.
  // Server-side unlock window is kept short (≤5 min) and serves only as
  // defense-in-depth against DevTools server-action calls — not as a UX
  // shortcut to skip the pinpad. getPinStatus is still consulted to decide
  // setupNew vs unlock mode (does the account have a PIN at all yet?).
  useEffect(() => {
    let cancelled = false;
    setMode("loading");
    getPinStatus(scope).then((status) => {
      if (cancelled) return;
      if (!status.authenticated) {
        setMode("loadError");
        return;
      }
      setMode(status.pinExists ? "unlock" : "setupNew");
    }).catch(() => {
      if (!cancelled) setMode("loadError");
    });
    return () => {
      cancelled = true;
    };
  }, [probe, scope]);

  useEffect(() => {
    if (!fallbackHint || !fallbackHintScope) {
      setShowFallbackHint(false);
      return;
    }
    let cancelled = false;
    hasPinAction(fallbackHintScope).then((res) => {
      if (cancelled) return;
      // Show hint only when the scope-specific hash is NOT set — that's the
      // window where admin PIN actually still unlocks this scope.
      setShowFallbackHint(res.exists === false);
    }).catch(() => {
      if (!cancelled) setShowFallbackHint(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackHint, fallbackHintScope, probe]);

  const flashError = useCallback((message: string) => {
    setError(message);
    setErrorKey((k) => k + 1);
  }, []);

  const handleUnlock = useCallback(async (pin: string) => {
    setPending(true);
    setError(null);
    try {
      const result = await verifyPin(pin, scope);
      if (result.error) {
        flashError(pinErrorMessage(result.error, t));
        return;
      }
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {}
      onUnlocked();
    } catch (err) {
      // Server action threw (network blip, runtime error, RPC type mismatch).
      // Surface a generic message instead of a frozen "verifying" spinner.
      console.error("[PinGate] verifyPin threw:", err);
      flashError(pinErrorMessage("internal", t));
    } finally {
      setPending(false);
    }
  }, [flashError, onUnlocked, sessionKey, scope, t]);

  const handleNewPin = useCallback((pin: string) => {
    setNewPin(pin);
    setError(null);
    setMode("setupConfirm");
    setResetKey((k) => k + 1);
  }, []);

  const handleConfirmSetup = useCallback(async (pin: string) => {
    if (pin !== newPin) {
      flashError(t.pin.mismatch);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await setPinAction(null, pin);
      if (result.error) {
        flashError(pinErrorMessage(result.error, t));
        if (result.error !== "wrong_pin") {
          setNewPin(null);
          setMode("setupNew");
          setResetKey((k) => k + 1);
        }
        return;
      }
      // Clear captured PIN before unlocking (minimise DevTools-visible window).
      setNewPin(null);
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {}
      onUnlocked();
    } catch (err) {
      console.error("[PinGate] setPin threw:", err);
      flashError(pinErrorMessage("internal", t));
    } finally {
      setPending(false);
    }
  }, [flashError, newPin, onUnlocked, sessionKey, t]);

  const backToSetupNew = useCallback(() => {
    setNewPin(null);
    setError(null);
    setMode("setupNew");
    setResetKey((k) => k + 1);
  }, []);

  if (mode === "loading") {
    return (
      <div className="max-w-sm mx-auto mt-12">
        <div className="h-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  if (mode === "loadError") {
    return (
      <div className="max-w-sm mx-auto mt-8 sm:mt-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/40 inline-flex items-center justify-center mb-4">
            <LockIcon width={28} height={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">
            {t.pin.loadError}
          </h2>
          <button
            type="button"
            onClick={() => setProbe((p) => p + 1)}
            className="cursor-pointer mt-6 w-full h-11 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
          >
            {t.pin.retry}
          </button>
        </div>
      </div>
    );
  }

  const heading =
    mode === "unlock"
      ? unlockTitle
      : t.pin.setupTitle;
  const subtitle =
    mode === "unlock"
      ? t.pin.unlockSubtitle
      : mode === "setupNew"
        ? t.pin.setupSubtitle
        : t.pin.enterConfirm;

  return (
    <div className="max-w-sm mx-auto mt-8 sm:mt-12">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 inline-flex items-center justify-center mb-4">
            <LockIcon width={28} height={28} className="text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">
            {heading}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          {/* Fallback hint shown only while the scope-specific hash isn't
              set yet — once the user sets a Lager-PIN the admin PIN stops
              unlocking /stock and the hint would mislead. */}
          {fallbackHint && mode === "unlock" && showFallbackHint && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {fallbackHint}
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-900 text-center"
          >
            {error}
          </div>
        )}

        <PinPad
          // Remount on mode change so there's no carryover from previous
          // digits / submittedRef state. Prevents a race where the user
          // taps on the new screen before the reset effect has cleared the
          // old digits, losing the first keypress.
          key={mode}
          onComplete={
            mode === "unlock"
              ? handleUnlock
              : mode === "setupNew"
                ? handleNewPin
                : handleConfirmSetup
          }
          disabled={pending}
          errorKey={errorKey}
          resetKey={resetKey}
        />

        {pending && (
          <p className="mt-4 text-xs text-center text-slate-500 dark:text-slate-400">
            {t.pin.verifying}
          </p>
        )}

        {mode === "setupConfirm" && !pending && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={backToSetupNew}
              className="cursor-pointer text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline-offset-2 hover:underline transition-colors"
            >
              ← {t.pin.back}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
