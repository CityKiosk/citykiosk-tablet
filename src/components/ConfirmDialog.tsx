"use client";

import Modal from "./Modal";
import { useI18n } from "./I18nProvider";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <Modal title={title || t.confirm.title} onClose={onCancel}>
      <div className="px-6 py-5">
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{message}</p>
      </div>
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer h-10 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
        >
          {cancelLabel || t.confirm.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className={`cursor-pointer h-10 px-4 rounded-lg text-sm font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 transition-colors ${
            destructive
              ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/60"
              : "bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-500/60"
          }`}
        >
          {confirmLabel || t.confirm.confirm}
        </button>
      </div>
    </Modal>
  );
}
