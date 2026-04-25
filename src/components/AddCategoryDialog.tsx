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
  const [nameTr, setNameTr] = useState("");
  const [nameDe, setNameDe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputCls =
    "w-full h-11 px-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tr = nameTr.trim();
    const de = nameDe.trim();
    if (!tr) {
      setError(t.addCategory.nameRequired);
      return;
    }
    // Generate slug from TR name
    const slug = tr
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const formData = new FormData();
    formData.set("name_tr", tr);
    formData.set("name_de", de || tr);
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
          <label htmlFor="ac-name-tr" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.addCategory.nameLabel} (TR) <span className="text-red-500">*</span>
          </label>
          <input
            id="ac-name-tr"
            type="text"
            value={nameTr}
            onChange={(e) => setNameTr(e.target.value)}
            required
            autoFocus
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="ac-name-de" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.addCategory.nameLabel} (DE)
          </label>
          <input
            id="ac-name-de"
            type="text"
            value={nameDe}
            onChange={(e) => setNameDe(e.target.value)}
            placeholder={nameTr || "—"}
            className={inputCls}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{t.addCategory.nameHint}</p>
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
