"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker, type Matcher } from "react-day-picker";
import { de } from "date-fns/locale";
import "react-day-picker/style.css";
import { CalendarIcon, XIcon } from "@/components/icons";
import { toIsoDay, fromIsoDay, formatDateDe } from "@/lib/dateRange";

type Props = {
  value: string; // YYYY-MM-DD or ""
  onChange: (next: string) => void;
  placeholder: string;
  todayLabel: string;
  clearLabel: string;
  ariaLabel: string;
  // Cross-bound min/max so a Von picker can disable days after the Bis value
  // (and vice versa). Both inclusive.
  min?: string;
  max?: string;
  startYear?: number;
  endYear?: number;
};

const POPOVER_WIDTH = 320;
const POPOVER_GAP = 8;

export default function DatePicker({
  value,
  onChange,
  placeholder,
  todayLabel,
  clearLabel,
  ariaLabel,
  min,
  max,
  startYear = 2024,
  endYear = new Date().getFullYear() + 1,
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Position the popover under the trigger and clamp to viewport edges.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    function place() {
      const rect = triggerRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = rect.left;
      if (left + POPOVER_WIDTH > vw - 8) {
        left = Math.max(8, vw - POPOVER_WIDTH - 8);
      }
      let top = rect.bottom + POPOVER_GAP;
      const estHeight = 380;
      if (top + estHeight > vh - 8 && rect.top > vh / 2) {
        top = Math.max(8, rect.top - estHeight - POPOVER_GAP);
      }
      setCoords({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Click outside + ESC to close.
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

  const triggerLabel = value ? formatDateDe(value) : placeholder;
  const hasValue = !!value;
  const selectedDate = fromIsoDay(value);
  const minDate = fromIsoDay(min ?? "");
  const maxDate = fromIsoDay(max ?? "");

  // Single-mode: a day click is the apply gesture. Close immediately.
  function handleSelect(d: Date | undefined) {
    if (!d) return;
    onChange(toIsoDay(d));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleToday() {
    const today = new Date();
    if (minDate && today < minDate) return;
    if (maxDate && today > maxDate) return;
    onChange(toIsoDay(today));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleClear() {
    onChange("");
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleClearTriggerX(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  const dropdownCls =
    "appearance-none cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-50 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md pl-3 pr-7 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 border-0";

  // RDP `disabled` accepts an array of matchers; combine min + max.
  const disabledMatchers: Matcher[] = [];
  if (minDate) disabledMatchers.push({ before: minDate });
  if (maxDate) disabledMatchers.push({ after: maxDate });

  const popover = open && (
    <>
      <div
        className="fixed inset-0 z-30 bg-slate-900/10 dark:bg-slate-950/30 md:bg-transparent"
        aria-hidden="true"
      />
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel}
        style={{ position: "fixed", top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
        className="z-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 p-3"
      >
        <DayPicker
          mode="single"
          locale={de}
          weekStartsOn={1}
          numberOfMonths={1}
          defaultMonth={selectedDate ?? new Date()}
          selected={selectedDate}
          onSelect={handleSelect}
          captionLayout="dropdown"
          startMonth={new Date(startYear, 0)}
          endMonth={new Date(endYear, 11)}
          disabled={disabledMatchers.length ? disabledMatchers : undefined}
          showOutsideDays
          classNames={{
            root: "rdp-root",
            months: "flex flex-col",
            month: "space-y-2",
            month_caption: "flex items-center justify-center gap-2 h-9",
            caption_label: "hidden",
            dropdowns: "flex items-center gap-2",
            dropdown_root: "relative",
            dropdown: dropdownCls,
            chevron: "fill-slate-500 dark:fill-slate-400",
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
            disabled:
              "[&>button]:text-slate-300 dark:[&>button]:text-slate-600 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent dark:[&>button]:hover:bg-transparent",
            selected:
              "[&>button]:bg-sky-600 [&>button]:text-white [&>button]:hover:bg-sky-700",
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
          <button
            type="button"
            onClick={handleClear}
            className="cursor-pointer h-9 px-3 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          >
            {clearLabel}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`cursor-pointer inline-flex items-center gap-2 h-10 pl-3 pr-2 rounded-lg border text-sm transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
          hasValue
            ? "border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100"
            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        }`}
      >
        <CalendarIcon width={16} height={16} className="opacity-70 flex-shrink-0" />
        <span className="truncate flex-1 text-left">{triggerLabel}</span>
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

      {/* Portal so the popover escapes any overflow-hidden ancestor. */}
      {mounted && popover && createPortal(popover, document.body)}
    </div>
  );
}
