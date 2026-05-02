"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import PinPad from "@/components/PinPad";
import { useI18n } from "@/components/I18nProvider";
import {
  setPin as setPinAction,
  hasPin as hasPinAction,
  type PinErrorCode,
  type PinHashScope,
} from "@/app/(dashboard)/settings/actions";

type Step = "current" | "new" | "confirm";

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

type Props = {
  onClose: () => void;
  onSaved: () => void;
  // Which hash to set/rotate. Default is the admin/master PIN; "stock"
  // sets the optional Lager-PIN. Other PinScope values aren't valid here
  // because per-screen unlock scopes (orders, customers) don't carry a
  // separate hash — they use the default PIN.
  scope?: PinHashScope;
};

export default function PinChangeDialog({ onClose, onSaved, scope = "default" }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("current");
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [pending, setPending] = useState(false);
  // Whether THIS scope already has a PIN set. If not, the dialog skips the
  // "current PIN" step (first-time setup) — but only when the rotation is
  // for a non-default scope. The default PIN's first-time setup happens via
  // PinGate's setupNew flow, not here.
  const [scopeHasPin, setScopeHasPin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (scope === "default") {
      setScopeHasPin(true);
      return;
    }
    hasPinAction(scope).then((res) => {
      if (cancelled) return;
      // For non-default scopes we always require a current-PIN step. Even on
      // first-time setup the server insists on the admin PIN as proof of
      // authorization (the RPC's "no hashes at all" bypass branch is only
      // for brand-new users who haven't set the admin PIN yet — unreachable
      // from /settings, which is itself PIN-gated). The label below adapts:
      // "Aktuelle PIN oder Admin-PIN" makes the override explicit.
      setScopeHasPin(res.exists === undefined ? true : !!res.exists);
    });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  function flash(msg: string) {
    setError(msg);
    setErrorKey((k) => k + 1);
  }

  function advance(next: Step) {
    setError(null);
    setStep(next);
    setResetKey((k) => k + 1);
  }

  async function onComplete(pin: string) {
    if (step === "current") {
      setCurrentPin(pin);
      advance("new");
      return;
    }
    if (step === "new") {
      setNewPin(pin);
      advance("confirm");
      return;
    }
    // step === "confirm"
    if (pin !== newPin) {
      flash(t.pin.mismatch);
      return;
    }
    setPending(true);
    try {
      const result = await setPinAction(currentPin, pin, scope);
      if (result.error) {
        flash(pinErrorMessage(result.error, t));
        if (result.error === "wrong_pin") {
          // Bad current PIN — restart from the very first step.
          setCurrentPin(null);
          setNewPin(null);
          setStep("current");
        } else {
          // Internal / rate-limited / mismatch — current PIN is fine, just
          // re-prompt the confirmation so the user isn't stuck on a fully
          // filled disabled PinPad.
          setStep("confirm");
        }
        setResetKey((k) => k + 1);
        return;
      }
      setCurrentPin(null);
      setNewPin(null);
      onSaved();
    } catch (err) {
      // Server action threw (network blip, RPC error, etc.). Without this
      // catch the dialog stays stuck on "Wird gespeichert..." because the
      // setPending(false) below would never run.
      console.error("[PinChangeDialog] setPin threw:", err);
      flash(pinErrorMessage("internal", t));
      setStep("confirm");
      setResetKey((k) => k + 1);
    } finally {
      setPending(false);
    }
  }

  function goBack() {
    setError(null);
    if (step === "new") {
      setCurrentPin(null);
      setStep("current");
    } else if (step === "confirm") {
      setNewPin(null);
      setStep("new");
    }
    setResetKey((k) => k + 1);
  }

  // Title + first-step label depend on which PIN we're rotating. Non-default
  // scopes accept either the current scope PIN OR the admin PIN — surfaced
  // in the prompt so the owner knows the admin override is available.
  const title =
    scope === "stock" ? t.pin.changeStockSection : t.pin.changeSection;
  const enterCurrentLabel =
    scope === "stock" ? t.pin.enterCurrentOrAdmin : t.pin.enterCurrent;
  const label =
    step === "current"
      ? enterCurrentLabel
      : step === "new"
        ? t.pin.enterNew
        : t.pin.enterConfirm;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="px-6 py-6">
        {error && (
          <div
            role="alert"
            className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-900 text-center"
          >
            {error}
          </div>
        )}
        <PinPad
          key={step}
          label={label}
          onComplete={onComplete}
          disabled={pending || scopeHasPin === null}
          errorKey={errorKey}
          resetKey={resetKey}
        />
        {pending && (
          <p className="mt-4 text-xs text-center text-slate-500 dark:text-slate-400">
            {t.pin.saving}
          </p>
        )}
        {!pending && step !== "current" && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={goBack}
              className="cursor-pointer text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline-offset-2 hover:underline transition-colors"
            >
              ← {t.pin.back}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
