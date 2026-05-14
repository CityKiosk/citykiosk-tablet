"use client";

// ============================================================================
// DiscountEditor — owner-only order-level discount entry, gated behind admin PIN
// ============================================================================
// Reached only by long-pressing the GESAMT label in CartSheet. Customer at the
// counter sees nothing that hints at this — the gesture is private to the
// owner. The component renders as a numeric pad (looks like a calculator,
// not like a discount knob) and reuses the existing settings-scope PIN.
// ============================================================================

import { useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";
import Modal from "./Modal";
import PinPad from "./PinPad";
import { DeleteIcon } from "./icons";
import { verifyPin, type PinErrorCode } from "@/app/(dashboard)/settings/actions";
import { MAX_DISCOUNT_PCT } from "@/lib/tax";

function pinErrorMessage(code: PinErrorCode, t: ReturnType<typeof useI18n>["t"]): string {
  switch (code) {
    case "wrong_pin":
    case "invalid_format":
      return t.pin.incorrect;
    case "rate_limited":
      return t.pin.tooManyAttempts;
    default:
      return t.pin.saveError;
  }
}

type Props = {
  /** Current discount percentage; the editor opens pre-filled with it. */
  value: number;
  /** Called with the new clamped percentage. Pass 0 to clear. */
  onApply: (pct: number) => void;
  onClose: () => void;
};

export default function DiscountEditor({ value, onApply, onClose }: Props) {
  const { t } = useI18n();

  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinErrorKey, setPinErrorKey] = useState(0);
  const [pinPending, setPinPending] = useState(false);

  const [draft, setDraft] = useState<string>(value > 0 ? String(value) : "");

  useEffect(() => {
    setDraft(value > 0 ? String(value) : "");
  }, [value]);

  async function handleVerifyPin(pin: string) {
    setPinPending(true);
    setPinError(null);
    const result = await verifyPin(pin, "settings");
    setPinPending(false);
    if (result.error) {
      setPinError(pinErrorMessage(result.error, t));
      setPinErrorKey((k) => k + 1);
      return;
    }
    setPinVerified(true);
  }

  function appendDigit(d: string) {
    setDraft((cur) => {
      const next = (cur + d).replace(/^0+(?=\d)/, "");
      const n = Number(next);
      if (!Number.isFinite(n)) return cur;
      if (n > MAX_DISCOUNT_PCT) return String(MAX_DISCOUNT_PCT);
      return next;
    });
  }
  function backspace() {
    setDraft((cur) => cur.slice(0, -1));
  }

  function handleApply() {
    const n = Number(draft);
    const clamped = Number.isFinite(n) ? Math.max(0, Math.min(MAX_DISCOUNT_PCT, Math.trunc(n))) : 0;
    onApply(clamped);
    onClose();
  }
  function handleClear() {
    onApply(0);
    onClose();
  }

  if (!pinVerified) {
    return (
      <Modal title={t.discount.title} onClose={onClose} size="md">
        <div className="px-6 py-8 flex flex-col items-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6">
            {t.pin.unlockSubtitle}
          </p>
          {pinError && (
            <div
              role="alert"
              className="mb-4 w-full max-w-sm px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-900 text-center"
            >
              {pinError}
            </div>
          )}
          <PinPad onComplete={handleVerifyPin} disabled={pinPending} errorKey={pinErrorKey} />
          {pinPending && (
            <p className="mt-4 text-xs text-center text-slate-500 dark:text-slate-400">
              {t.pin.verifying}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t.discount.title} onClose={onClose} size="md">
      <div className="px-6 py-6">
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-3 uppercase tracking-wider font-medium">
          {t.discount.label}
        </p>
        <div className="flex items-baseline justify-center gap-1 mb-6">
          <span className="tabular text-5xl font-bold text-slate-900 dark:text-slate-50">
            {draft === "" ? "0" : draft}
          </span>
          <span className="text-2xl font-semibold text-slate-500 dark:text-slate-400">%</span>
        </div>

        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => appendDigit(d)}
              className="cursor-pointer h-14 rounded-xl text-2xl font-semibold text-slate-900 dark:text-slate-50 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-all tabular"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            aria-label={t.discount.remove}
            className="cursor-pointer h-14 rounded-xl text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-all"
          >
            {t.discount.removeShort}
          </button>
          <button
            type="button"
            onClick={() => appendDigit("0")}
            className="cursor-pointer h-14 rounded-xl text-2xl font-semibold text-slate-900 dark:text-slate-50 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-all tabular"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            aria-label={t.common.delete}
            className="cursor-pointer h-14 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-all inline-flex items-center justify-center"
          >
            <DeleteIcon width={20} height={20} />
          </button>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer h-10 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="cursor-pointer h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
        >
          {t.discount.apply}
        </button>
      </div>
    </Modal>
  );
}
