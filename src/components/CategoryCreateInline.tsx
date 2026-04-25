"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "./I18nProvider";
import { useToast } from "./Toast";
import { PlusIcon, XIcon } from "./icons";
import { addCategoryQuick } from "@/app/(dashboard)/catalog/actions";

type Props = {
  /** Called with the new category id once the row is inserted. The parent
   *  is responsible for refetching its categories list and selecting the
   *  new id in its dropdown. */
  onCreated: (newId: string, name: string) => void;
  /** Disabled while the parent form is busy (e.g. saving the parent product
   *  — don't let the inline create hijack focus during a submit). */
  disabled?: boolean;
};

/**
 * Inline category create — sits under the Kategorie dropdown inside ProductForm.
 *
 * UX (from the design review):
 *   - Default state: a small "+ Neue Kategorie" trigger row, finger-sized.
 *   - Active state: trigger collapses, single text input + Save/Cancel.
 *   - Tablet keyboard: scrollIntoView so the input doesn't end up under the
 *     soft keyboard.
 *   - Single field (DE only) — TR is mirrored server-side to keep the DB
 *     NOT NULL happy without forcing the owner to type bilingually.
 *   - No modal. The parent product form's state must survive intact, so
 *     opening a second dialog would defeat the point.
 */
export default function CategoryCreateInline({ onCreated, disabled }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [active, setActive] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Tablet ergonomics: when the input opens, push it into view above the
  // virtual keyboard. iOS Safari needs a microtask delay so the layout has
  // settled before scrolling.
  useEffect(() => {
    if (!active) return;
    const handle = window.setTimeout(() => {
      inputRef.current?.focus();
      wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => window.clearTimeout(handle);
  }, [active]);

  function reset() {
    setActive(false);
    setName("");
    setError(null);
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t.addCategory.nameRequired);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addCategoryQuick(trimmed);
      if (result.error || !result.id) {
        setError(result.error || t.addCategory.saveError);
        return;
      }
      const newId = result.id;
      onCreated(newId, trimmed);
      toast.show(t.addCategory.added);
      reset();
    });
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        disabled={disabled}
        className="cursor-pointer mt-2 w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-sm font-medium text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
      >
        <PlusIcon width={16} height={16} />
        {t.addCategory.quickAdd}
      </button>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="mt-2 rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              reset();
            }
          }}
          placeholder={t.addCategory.placeholder}
          maxLength={100}
          disabled={isPending}
          className="flex-1 min-w-0 h-11 px-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !name.trim()}
          className="cursor-pointer h-11 px-4 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? t.common.loading : t.addCategory.save}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={isPending}
          aria-label={t.common.cancel}
          className="cursor-pointer h-11 w-11 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
        >
          <XIcon width={18} height={18} />
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
