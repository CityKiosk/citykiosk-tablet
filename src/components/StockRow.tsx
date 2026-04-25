"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { AlertTriangleIcon, CheckIcon, Loader2Icon, MinusIcon, PlusIcon } from "./icons";
import type { StockProduct } from "@/app/(dashboard)/stock/types";

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  product: StockProduct;
  categoryName: string | null;
  onPersist: (productId: string, nextStock: number, previousStock: number) => Promise<number | null>;
  onOpenDetail: (product: StockProduct) => void;
};

const SAVED_FADE_MS = 1800;

function StockRowInner({ product, categoryName, onPersist, onOpenDetail }: Props) {
  const { t, locale } = useI18n();
  const [value, setValue] = useState<number>(product.stock);
  const [draft, setDraft] = useState<string>(String(product.stock));
  const [lastPersisted, setLastPersisted] = useState<number>(product.stock);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync with server-pushed updates (e.g. order decrement
  // arrives via revalidatePath). Only sync when the user has NOT made local
  // edits — otherwise we'd silently overwrite their pending input.
  useEffect(() => {
    const userIsEditing = draft !== String(lastPersisted);
    if (!userIsEditing && product.stock !== lastPersisted) {
      setValue(product.stock);
      setDraft(String(product.stock));
      setLastPersisted(product.stock);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.stock]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const commit = useCallback(
    async (next: number, previous: number) => {
      if (next === previous) {
        setSaveState("idle");
        return;
      }
      setSaveState("saving");
      const persisted = await onPersist(product.id, next, previous);
      if (persisted === null) {
        setSaveState("error");
        return;
      }
      setLastPersisted(persisted);
      setValue(persisted);
      setDraft(String(persisted));
      setSaveState("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setSaveState((s) => (s === "saved" ? "idle" : s));
      }, SAVED_FADE_MS);
    },
    [onPersist, product.id],
  );

  function apply(next: number) {
    // Update draft only — commit happens when the user clicks "Kaydet" or
    // presses Enter. Auto-save on blur/stepper was surprising (users clicking
    // outside the input saw their value save before they reached the button).
    setValue(next);
    setDraft(String(next));
    setSaveState("idle");
  }

  function handleDecrement() {
    apply(value - 1);
  }
  function handleIncrement() {
    apply(value + 1);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow intermediate strings: "", "-", "-3" — defer validation to blur/commit.
    if (raw === "" || raw === "-" || /^-?\d{1,6}$/.test(raw)) {
      setDraft(raw);
      setSaveState("idle");
    }
  }

  function parseDraft(): number | null {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
    return Math.max(-9999, Math.min(999999, parsed));
  }

  function handleInputBlur() {
    // Normalize the draft only — do NOT commit. Commit is explicit via the
    // "Kaydet" button or Enter key, so clicking outside the field never
    // silently persists.
    const clamped = parseDraft();
    if (clamped === null) {
      setDraft(String(value));
      return;
    }
    setValue(clamped);
    setDraft(String(clamped));
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Prevent the virtual keyboard / browser from jumping focus to the next
      // input in the list. Persist immediately instead.
      e.preventDefault();
      const clamped = parseDraft();
      if (clamped === null) {
        setDraft(String(value));
        return;
      }
      setValue(clamped);
      setDraft(String(clamped));
      if (timerRef.current) clearTimeout(timerRef.current);
      void commit(clamped, lastPersisted);
      e.currentTarget.blur();
    }
  }

  function handleSaveClick() {
    const clamped = parseDraft();
    if (clamped === null) {
      setDraft(String(value));
      return;
    }
    setValue(clamped);
    setDraft(String(clamped));
    if (timerRef.current) clearTimeout(timerRef.current);
    void commit(clamped, lastPersisted);
  }

  async function handleRetry() {
    await commit(value, lastPersisted);
  }

  const name = product.name_de;
  const isNegative = value < 0;
  const isLow = value >= 0 && value <= 5;
  // Parsed draft (or null). Dirty = draft parses to something != last persisted.
  const draftParsed = (() => {
    const n = Number(draft);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    return Math.max(-9999, Math.min(999999, n));
  })();
  const isDirty = draftParsed !== null && draftParsed !== lastPersisted;

  return (
    <li className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      {/* Clickable detail area — thumbnail + name + meta. Tapping here opens
          the detail dialog. Stepper/input/save live outside this button so
          they stay independently interactive. */}
      <button
        type="button"
        onClick={() => onOpenDetail(product)}
        className="cursor-pointer flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 -m-1 p-1 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
      >
        <span className="flex-shrink-0 w-12 h-12 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
          {product.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.image_url}
              alt=""
              loading="lazy"
              width={48}
              height={48}
              className="w-full h-full object-contain"
            />
          ) : null}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
            {name}
          </span>
          <span className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {categoryName && <span className="truncate">{categoryName}</span>}
            {product.sku && (
              <>
                {categoryName && <span aria-hidden="true">·</span>}
                <span className="truncate">{t.product.artNr} {product.sku}</span>
              </>
            )}
          </span>
          {isNegative && (
            <span className="flex items-center gap-1 mt-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
              <AlertTriangleIcon width={12} height={12} />
              <span>{t.stock.negativeWarning}</span>
            </span>
          )}
        </span>
      </button>

      {/* Save indicator + confirm button — only takes space when there is
          something to show, so the name area isn't crushed on narrow phones. */}
      {(saveState !== "idle" || isDirty) && (
        <div
          className="flex items-center justify-end flex-shrink-0 text-[11px] font-medium"
          aria-live="polite"
        >
          {saveState === "saving" ? (
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Loader2Icon width={12} height={12} className="animate-spin" />
              <span className="hidden sm:inline">{t.stock.saving}</span>
            </span>
          ) : saveState === "error" ? (
            <button
              type="button"
              onClick={handleRetry}
              className="cursor-pointer flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 rounded"
            >
              <AlertTriangleIcon width={12} height={12} />
              <span className="hidden sm:inline">{t.stock.retry}</span>
            </button>
          ) : isDirty ? (
            <button
              type="button"
              onClick={handleSaveClick}
              aria-label={t.common.save}
              className="cursor-pointer inline-flex items-center gap-1 h-9 px-2 sm:px-3 rounded-lg text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
            >
              <CheckIcon width={14} height={14} />
              <span className="hidden sm:inline">{t.common.save}</span>
            </button>
          ) : saveState === "saved" ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckIcon width={12} height={12} />
              <span className="hidden sm:inline">{t.stock.saved}</span>
            </span>
          ) : null}
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={handleDecrement}
          aria-label={t.stock.decrement(name)}
          className="cursor-pointer w-11 h-11 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
        >
          <MinusIcon width={16} height={16} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="-?[0-9]*"
          enterKeyHint="done"
          value={draft}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t.stock.valueLabel(name)}
          className={`w-16 h-11 px-2 text-center tabular text-sm font-semibold border border-slate-300 dark:border-slate-700 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 bg-white dark:bg-slate-950 ${
            isNegative
              ? "text-rose-600 dark:text-rose-400"
              : isLow
              ? "text-amber-600 dark:text-amber-400"
              : "text-slate-900 dark:text-slate-50"
          }`}
        />
        <button
          type="button"
          onClick={handleIncrement}
          aria-label={t.stock.increment(name)}
          className="cursor-pointer w-11 h-11 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
        >
          <PlusIcon width={16} height={16} />
        </button>
      </div>
    </li>
  );
}

export const StockRow = memo(StockRowInner);
