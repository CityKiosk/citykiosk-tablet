"use client";

import { useState, useTransition } from "react";
import Modal from "./Modal";
import { useI18n } from "./I18nProvider";
import { addCategory } from "@/app/(dashboard)/catalog/actions";

export default function AddCategoryDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputCls =
    "w-full h-11 px-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t.addCategory.nameRequired);
      return;
    }
    // Generate slug from the German name (single-locale app).
    const slug = trimmed
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const formData = new FormData();
    formData.set("name_de", trimmed);
    formData.set("slug", slug);

    startTransition(async () => {
      const result = await addCategory({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal title={t.addCategory.title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-900"
          >
            {error}
          </div>
        )}
        <div>
          <label htmlFor="ac-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.addCategory.nameLabel} <span className="text-red-500">*</span>
          </label>
          <input
            id="ac-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            className={inputCls}
          />
        </div>
      </form>
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="cursor-pointer h-10 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
          disabled={isPending}
          className="cursor-pointer h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
        >
          {isPending ? t.common.loading : t.addCategory.save}
        </button>
      </div>
    </Modal>
  );
}
