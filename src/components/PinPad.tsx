"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { DeleteIcon } from "@/components/icons";

const PIN_LENGTH = 6;
const DIGIT_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
] as const;

type Props = {
  /** Called with the full PIN when the user reaches PIN_LENGTH digits. */
  onComplete: (pin: string) => void;
  /** Shake + red-tint the dots and clear input. Flip to a new value to retrigger. */
  errorKey?: number;
  /** Disable input (during async verify / rate-limit lockout). */
  disabled?: boolean;
  /** Optional prompt shown above the dots. */
  label?: string;
  /** Reset pin when this value changes (e.g. step transition in setup flow). */
  resetKey?: number;
};

export default function PinPad({
  onComplete,
  errorKey,
  disabled,
  label,
  resetKey,
}: Props) {
  const { t } = useI18n();
  const [digits, setDigits] = useState<string>("");
  const [shaking, setShaking] = useState(false);
  const lastErrorKey = useRef<number | undefined>(errorKey);
  const lastResetKey = useRef<number | undefined>(resetKey);
  const submittedRef = useRef(false);

  // Auto-submit once full. Guard against duplicate submits (React re-renders).
  useEffect(() => {
    if (digits.length === PIN_LENGTH && !submittedRef.current) {
      submittedRef.current = true;
      onComplete(digits);
    }
  }, [digits, onComplete]);

  // External reset: clear input + allow resubmit.
  useEffect(() => {
    if (resetKey !== lastResetKey.current) {
      lastResetKey.current = resetKey;
      setDigits("");
      submittedRef.current = false;
    }
  }, [resetKey]);

  // External error signal: shake + clear.
  useEffect(() => {
    if (errorKey !== undefined && errorKey !== lastErrorKey.current) {
      lastErrorKey.current = errorKey;
      setShaking(true);
      setDigits("");
      submittedRef.current = false;
      const id = setTimeout(() => setShaking(false), 450);
      return () => clearTimeout(id);
    }
  }, [errorKey]);

  const press = useCallback(
    (digit: string) => {
      if (disabled || submittedRef.current) return;
      setDigits((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        return prev + digit;
      });
    },
    [disabled],
  );

  const backspace = useCallback(() => {
    if (disabled || submittedRef.current) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [disabled]);

  // Keyboard support for desktop dev / a11y.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (disabled) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, press, backspace]);

  return (
    <div className="flex flex-col items-center gap-6">
      {label && (
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
          {label}
        </p>
      )}

      {/* Dots */}
      <div
        className={`flex items-center gap-3 ${shaking ? "animate-pin-shake" : ""}`}
        role="status"
        aria-live="polite"
        aria-label={t.pin.dotsProgress(digits.length, PIN_LENGTH)}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < digits.length;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                shaking
                  ? "bg-red-500 border-red-500"
                  : filled
                    ? "bg-slate-900 border-slate-900 dark:bg-slate-100 dark:border-slate-100"
                    : "bg-transparent border-slate-300 dark:border-slate-600"
              }`}
            />
          );
        })}
      </div>

      {/* Keypad */}
      <div
        role="group"
        aria-label="PIN"
        className="grid grid-cols-3 gap-3"
        // Prevent virtual keyboard from ever showing; all input via pad / hardware keyboard.
        onContextMenu={(e) => e.preventDefault()}
      >
        {DIGIT_ROWS.flat().map((d) => (
          <PadButton
            key={d}
            label={t.pin.digit(Number(d))}
            disabled={disabled}
            onClick={() => press(d)}
          >
            {d}
          </PadButton>
        ))}
        <span aria-hidden="true" className="w-[72px] h-[72px] sm:w-20 sm:h-20" />
        <PadButton
          label={t.pin.digit(0)}
          disabled={disabled}
          onClick={() => press("0")}
        >
          0
        </PadButton>
        <PadButton
          label={t.pin.backspace}
          disabled={disabled || digits.length === 0}
          onClick={backspace}
          variant="icon"
        >
          <DeleteIcon width={22} height={22} />
        </PadButton>
      </div>
    </div>
  );
}

function PadButton({
  children,
  label,
  onClick,
  disabled,
  variant = "digit",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "digit" | "icon";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`cursor-pointer w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-2xl text-2xl font-medium tabular-nums transition-all duration-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 disabled:opacity-40 disabled:cursor-not-allowed ${
        variant === "digit"
          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50 hover:bg-slate-200 dark:hover:bg-slate-700"
          : "bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
