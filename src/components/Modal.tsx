"use client";

import { ReactNode, useEffect, useId, useRef } from "react";
import { useI18n } from "./I18nProvider";
import { XIcon } from "./icons";
import { lockBodyScroll } from "@/lib/scrollLock";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
};

export default function Modal({ title, onClose, children, size = "md" }: ModalProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (dialogRef.current?.contains(document.activeElement)) onClose();
    }
    document.addEventListener("keydown", onKey);
    const releaseLock = lockBodyScroll();
    const first = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (first ?? dialogRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseLock();
      triggerRef.current?.focus?.();
    };
  }, [onClose]);

  function handleTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const maxW = size === "lg" ? "max-w-2xl md:max-w-3xl" : "max-w-md sm:max-w-lg md:max-w-xl";

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleTab}
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_60px_rgba(15,23,42,0.25)] border border-slate-200 dark:border-slate-800 ${maxW} w-full max-h-[90dvh] overflow-y-auto focus:outline-none animate-in zoom-in-95 duration-150`}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10 rounded-t-2xl">
          <h2 id={titleId} className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
          >
            <XIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
