"use client";

import { useI18n } from "./I18nProvider";
import { MinusIcon, PlusIcon } from "./icons";

type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, { btn: string; input: string; gap: string; icon: number }> = {
  // 40px butonlar + p-0.5 konteyner ≈ 44px efektif dokunma alanı (tablet minimumu)
  sm: { btn: "w-10 h-10", input: "w-10 h-10 text-sm", gap: "gap-0.5", icon: 15 },
  md: { btn: "w-10 h-10", input: "w-14 h-10 text-sm", gap: "gap-1.5", icon: 16 },
  lg: { btn: "w-11 h-11", input: "w-16 h-11 text-base", gap: "gap-2", icon: 18 },
};

export default function QtyControl({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  size?: Size;
}) {
  const { t } = useI18n();
  const s = sizeMap[size];

  return (
    <div
      className={`inline-flex items-center ${s.gap} bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5`}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        aria-label={t.catalog.qtyMinus(label)}
        className={`cursor-pointer ${s.btn} inline-flex items-center justify-center rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors`}
      >
        <MinusIcon width={s.icon} height={s.icon} />
      </button>
      <input
        // type="text" (not number) + inputMode="numeric" is more reliable on
        // iOS Safari: the number type has a known bug where select() on focus
        // swallows the first typed digit in some cases.
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        value={value === 0 ? "" : String(value)}
        placeholder="0"
        aria-label={t.catalog.qty(label)}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          if (digits === "") {
            onChange(0);
            return;
          }
          const n = parseInt(digits, 10);
          onChange(Math.max(0, Number.isFinite(n) ? n : 0));
        }}
        onFocus={(e) => e.currentTarget.select()}
        className={`tabular ${s.input} bg-transparent text-center font-semibold text-slate-900 dark:text-slate-50 placeholder-slate-400 border-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60`}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label={t.catalog.qtyPlus(label)}
        className={`cursor-pointer ${s.btn} inline-flex items-center justify-center rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors`}
      >
        <PlusIcon width={s.icon} height={s.icon} />
      </button>
    </div>
  );
}
