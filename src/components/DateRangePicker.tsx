"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { de } from "date-fns/locale";
import "react-day-picker/style.css";
import { CalendarIcon, XIcon } from "@/components/icons";
import {
  toIsoDay,
  fromIsoDay,
  formatDateDe,
  type DateRangeIso,
} from "@/lib/dateRange";

type Props = {
  value: DateRangeIso;
  onChange: (next: DateRangeIso) => void;
  placeholder: string;
  todayLabel: string;
  clearLabel: string;
  applyLabel: string;
  ariaLabel: string;
  // Bound the dropdown caption so it can't pull years that pre-date the shop
  // and don't run forever into the future.
  startYear?: number;
  endYear?: number;
};

export default function DateRangePicker({
  value,
  onChange,
  placeholder,
  todayLabel,
  clearLabel,
  applyLabel,
  ariaLabel,
  startYear = 2024,
  endYear = new Date().getFullYear() + 1,
}: Props) {
  const [open, setOpen] = useState(false);
  // Draft range — the picker mutates this freely while open; the parent only
  // sees the change after the user hits "Anwenden". This way you can fix a
  // wrong start click without immediately polluting the table.
  const [draft, setDraft] = useState<DateRange | undefined>(() => ({
    from: fromIsoDay(value.from),
    to: fromIsoDay(value.to),
  }));
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync draft when value changes from outside (preset chip click, clear all).
  useEffect(() => {
    if (!open) {
      setDraft({ from: fromIsoDay(value.from), to: fromIsoDay(value.to) });
    }
  }, [open, value.from, value.to]);

  // Click outside + ESC to close. Use pointerdown so a touch on the backdrop
  // dismisses without waiting for the synthesized click.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: PointerEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const triggerLabel = (() => {
    if (value.from && value.to) {
      if (value.from === value.to) return formatDateDe(value.from);
      return `${formatDateDe(value.from)} – ${formatDateDe(value.to)}`;
    }
    if (value.from) return `≥ ${formatDateDe(value.from)}`;
    if (value.to) return `≤ ${formatDateDe(value.to)}`;
    return placeholder;
  })();

  const hasValue = !!(value.from || value.to);
  const draftReady = !!(draft?.from && draft?.to);

  function handleApply() {
    onChange({
      from: draft?.from ? toIsoDay(draft.from) : "",
      to: draft?.to ? toIsoDay(draft.to) : "",
    });
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleClear() {
    setDraft(undefined);
    onChange({ from: "", to: "" });
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleToday() {
    const today = new Date();
    setDraft({ from: today, to: today });
  }

  function handleClearTriggerX(e: React.MouseEvent) {
    // Inline X on the trigger — bypass the popover, just clear directly.
    e.stopPropagation();
    onChange({ from: "", to: "" });
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`cursor-pointer inline-flex items-center gap-2 h-10 pl-3 pr-2 rounded-lg border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
          hasValue
            ? "border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100"
            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        }`}
      >
        <CalendarIcon width={16} height={16} className="opacity-70 flex-shrink-0" />
        <span className="truncate">{triggerLabel}</span>
        {hasValue && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear"
            onClick={handleClearTriggerX}
            className="ml-1 w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-sky-100 dark:hover:bg-sky-900/50 flex-shrink-0"
          >
            <XIcon width={13} height={13} />
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Subtle backdrop on tablet — gives a clear "tap-anywhere-to-dismiss"
              affordance without dimming the page like a modal. */}
          <div
            className="fixed inset-0 z-30 bg-slate-900/10 dark:bg-slate-950/30 md:bg-transparent"
            aria-hidden="true"
          />
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="false"
            aria-label={ariaLabel}
            className="absolute z-40 mt-2 left-0 sm:left-auto sm:right-0 md:left-0 md:right-auto w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/5 p-3"
          >
            <DayPicker
              mode="range"
              locale={de}
              weekStartsOn={1}
              numberOfMonths={1}
              defaultMonth={draft?.from ?? new Date()}
              selected={draft}
              onSelect={setDraft}
              captionLayout="dropdown"
              startMonth={new Date(startYear, 0)}
              endMonth={new Date(endYear, 11)}
              showOutsideDays
              classNames={{
                root: "rdp-root",
                months: "flex flex-col",
                month: "space-y-2",
                month_caption: "flex items-center justify-center gap-2 h-9",
                caption_label: "hidden",
                dropdowns: "flex items-center gap-1",
                dropdown:
                  "appearance-none cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-50 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                nav: "flex items-center justify-between",
                button_previous:
                  "cursor-pointer w-9 h-9 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
                button_next:
                  "cursor-pointer w-9 h-9 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
                month_grid: "w-full border-collapse",
                weekdays: "flex",
                weekday:
                  "w-10 h-8 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase",
                week: "flex",
                day: "w-10 h-10 text-center align-middle p-0 relative",
                day_button:
                  "cursor-pointer w-9 h-9 inline-flex items-center justify-center rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                today: "font-semibold ring-1 ring-sky-500 rounded-md",
                outside: "text-slate-300 dark:text-slate-600",
                disabled: "text-slate-200 dark:text-slate-700 cursor-not-allowed",
                selected:
                  "[&>button]:bg-sky-600 [&>button]:text-white [&>button]:hover:bg-sky-700",
                range_start:
                  "bg-sky-100 dark:bg-sky-900/40 rounded-l-md [&>button]:bg-sky-600 [&>button]:text-white",
                range_end:
                  "bg-sky-100 dark:bg-sky-900/40 rounded-r-md [&>button]:bg-sky-600 [&>button]:text-white",
                range_middle:
                  "bg-sky-100 dark:bg-sky-900/40 [&>button]:bg-transparent [&>button]:text-sky-900 dark:[&>button]:text-sky-100 [&>button]:hover:bg-sky-200 dark:[&>button]:hover:bg-sky-900/60",
              }}
            />
            <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleToday}
                className="cursor-pointer h-9 px-3 rounded-md text-xs font-medium text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              >
                {todayLabel}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="cursor-pointer h-9 px-3 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                >
                  {clearLabel}
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!draftReady}
                  className="cursor-pointer h-9 px-4 rounded-md text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                >
                  {applyLabel}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
