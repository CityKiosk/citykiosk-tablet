"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { useI18n } from "./I18nProvider";
import { formatPrice } from "@/lib/i18n";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
} from "./icons";
import type { StockProduct } from "@/app/(dashboard)/stock/types";

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  product: StockProduct;
  categoryName: string | null;
  prev: StockProduct | null;
  next: StockProduct | null;
  position: { current: number; total: number };
  onClose: () => void;
  onNavigate: (target: StockProduct, dirty: boolean) => void;
  onSave: (productId: string, nextStock: number, previousStock: number) => Promise<number | null>;
};

export default function StockDetailDialog({
  product,
  categoryName,
  prev,
  next,
  position,
  onClose,
  onNavigate,
  onSave,
}: Props) {
  const { t, locale } = useI18n();
  const [value, setValue] = useState<number>(product.stock);
  const [draft, setDraft] = useState<string>(String(product.stock));
  const [lastPersisted, setLastPersisted] = useState<number>(product.stock);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state whenever the modal switches to a different product
  // (prev/next navigation keeps the modal mounted and swaps the prop).
  useEffect(() => {
    setValue(product.stock);
    setDraft(String(product.stock));
    setLastPersisted(product.stock);
    setSaveState("idle");
  }, [product.id, product.stock]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const parseDraft = useCallback((): number | null => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
    return Math.max(-9999, Math.min(999999, parsed));
  }, [draft]);

  const draftParsed = parseDraft();
  const isDirty = draftParsed !== null && draftParsed !== lastPersisted;

  const name = product.name_de;
  const description = product.description_de || "";
  const isNegative = value < 0;
  // Match StockRow — anything under 100 is the low-stock signal, not just
  // the empty case.
  const isLow = value < 100;

  const commit = useCallback(
    async (next: number, previous: number): Promise<boolean> => {
      if (next === previous) {
        setSaveState("idle");
        return true;
      }
      setSaveState("saving");
      const persisted = await onSave(product.id, next, previous);
      if (persisted === null) {
        setSaveState("error");
        return false;
      }
      setLastPersisted(persisted);
      setValue(persisted);
      setDraft(String(persisted));
      setSaveState("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setSaveState((s) => (s === "saved" ? "idle" : s));
      }, 1800);
      return true;
    },
    [onSave, product.id],
  );

  function apply(n: number) {
    setValue(n);
    setDraft(String(n));
    setSaveState("idle");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "" || raw === "-" || /^-?\d{1,6}$/.test(raw)) {
      setDraft(raw);
      setSaveState("idle");
    }
  }

  function handleInputBlur() {
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
      e.preventDefault();
      const clamped = parseDraft();
      if (clamped === null) {
        setDraft(String(value));
        return;
      }
      setValue(clamped);
      setDraft(String(clamped));
      void commit(clamped, lastPersisted);
      e.currentTarget.blur();
    }
  }

  async function handleSaveClick() {
    const clamped = parseDraft();
    if (clamped === null) {
      setDraft(String(value));
      return;
    }
    setValue(clamped);
    setDraft(String(clamped));
    await commit(clamped, lastPersisted);
  }

  function handleNavigate(target: StockProduct | null) {
    if (!target) return;
    onNavigate(target, isDirty);
  }

  return (
    <Modal title={name} onClose={onClose} size="lg">
      <div className="px-6 py-5 space-y-5">
        {/* Nav + position */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleNavigate(prev)}
            disabled={!prev}
            aria-label={prev ? t.add2.prevItem(prev.name_de) : t.add2.prevItem("")}
            className="cursor-pointer inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
          >
            <ChevronLeftIcon width={14} height={14} />
            <span>{t.add2.saveAndNext ? "" : ""}</span>
          </button>
          <span className="text-xs tabular text-slate-500 dark:text-slate-400">
            {t.add2.itemPosition(position.current, position.total)}
          </span>
          <button
            type="button"
            onClick={() => handleNavigate(next)}
            disabled={!next}
            aria-label={next ? t.add2.nextItem(next.name_de) : t.add2.nextItem("")}
            className="cursor-pointer inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
          >
            <ChevronRightIcon width={14} height={14} />
          </button>
        </div>

        {/* Image */}
        {product.image_url && (
          <div className="mx-auto w-full max-w-sm aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url}
              alt=""
              className="w-full h-full object-contain p-2"
            />
          </div>
        )}

        {/* Details (read-only) */}
        <div className="space-y-3">
          {categoryName && (
            <ReadField label={t.add.category}>
              <span className="text-sm text-slate-700 dark:text-slate-300">{categoryName}</span>
            </ReadField>
          )}
          <ReadField label={t.add.price}>
            <span className="text-sm tabular font-semibold text-sky-700 dark:text-sky-400">
              {formatPrice(product.price, locale)}
            </span>
          </ReadField>
          {product.sku && (
            <ReadField label={t.product.artNr}>
              <span className="text-sm tabular text-slate-700 dark:text-slate-300">{product.sku}</span>
            </ReadField>
          )}
          {product.dimensions && (
            <ReadField label={t.product.dimensions}>
              <span className="text-sm text-slate-700 dark:text-slate-300">{product.dimensions}</span>
            </ReadField>
          )}
          {product.packaging_unit && product.packaging_unit > 0 && (
            <ReadField label={t.settings.display.packagingUnit}>
              <span className="text-sm tabular text-slate-700 dark:text-slate-300">
                {t.product.pack(product.packaging_unit)}
              </span>
            </ReadField>
          )}
          {description && (
            <ReadField label={t.add.desc}>
              <span className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{description}</span>
            </ReadField>
          )}
        </div>

        {/* Stock editor */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            {t.stock.title}
          </label>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => apply(value - 1)}
              aria-label={t.stock.decrement(name)}
              className="cursor-pointer w-12 h-12 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
            >
              <MinusIcon width={18} height={18} />
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
              onFocus={(e) => {
                // See StockRow — defer select to next frame so it survives
                // the cursor-positioning that runs after a touch tap.
                const target = e.currentTarget;
                requestAnimationFrame(() => target.select());
              }}
              onClick={(e) => e.currentTarget.select()}
              aria-label={t.stock.valueLabel(name)}
              className={`w-24 h-12 px-2 text-center tabular text-lg font-semibold border border-slate-300 dark:border-slate-700 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 bg-white dark:bg-slate-950 ${
                isLow
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-900 dark:text-slate-50"
              }`}
            />
            <button
              type="button"
              onClick={() => apply(value + 1)}
              aria-label={t.stock.increment(name)}
              className="cursor-pointer w-12 h-12 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
            >
              <PlusIcon width={18} height={18} />
            </button>
          </div>
          {isNegative && (
            <div className="flex items-center justify-center gap-1 mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              <AlertTriangleIcon width={14} height={14} />
              <span>{t.stock.negativeWarning}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl flex items-center justify-between gap-2">
        <div className="text-xs" aria-live="polite" />
        {/* Button on the right communicates state (idle/saving/saved/error). */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer h-10 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
          >
            {t.common.close}
          </button>
          {saveState === "saving" ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 shadow-sm opacity-70 cursor-not-allowed"
            >
              <Loader2Icon width={16} height={16} className="animate-spin" />
              {t.stock.saving}
            </button>
          ) : saveState === "error" ? (
            <button
              type="button"
              onClick={handleSaveClick}
              className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 transition-colors"
            >
              <AlertTriangleIcon width={16} height={16} />
              {t.stock.retry}
            </button>
          ) : isDirty ? (
            <button
              type="button"
              onClick={handleSaveClick}
              className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
            >
              <CheckIcon width={16} height={16} />
              {t.common.save}
            </button>
          ) : saveState === "saved" ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 cursor-default"
            >
              <CheckIcon width={16} height={16} />
              {t.stock.saved}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
            >
              <CheckIcon width={16} height={16} />
              {t.common.save}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ReadField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex-shrink-0">
        {label}
      </span>
      <div className="text-right min-w-0">{children}</div>
    </div>
  );
}
