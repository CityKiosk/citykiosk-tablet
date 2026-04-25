"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import PinPad from "@/components/PinPad";
import { useI18n } from "@/components/I18nProvider";
import { setPin as setPinAction, type PinErrorCode } from "@/app/(dashboard)/settings/actions";

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

export default function PinChangeDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("current");
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [pending, setPending] = useState(false);

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
    const result = await setPinAction(currentPin, pin);
    setPending(false);
    if (result.error) {
      flash(pinErrorMessage(result.error, t));
      // Wrong current PIN → restart from "current".
      if (result.error === "wrong_pin") {
        setCurrentPin(null);
        setNewPin(null);
        setStep("current");
        setResetKey((k) => k + 1);
      }
      return;
    }
    // Zero captured PIN values before handing off — minimise DevTools
    // visibility of the raw credentials.
    setCurrentPin(null);
    setNewPin(null);
    onSaved();
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

  const label =
    step === "current"
      ? t.pin.enterCurrent
      : step === "new"
        ? t.pin.enterNew
        : t.pin.enterConfirm;

  return (
    <Modal title={t.pin.changeSection} onClose={onClose}>
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
          disabled={pending}
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
