"use client";

import { useState, useTransition } from "react";
import Modal from "./Modal";
import { useI18n } from "./I18nProvider";
import {
  addCustomerFromSettings,
  updateCustomerFromSettings,
  type SettingsCustomer,
} from "@/app/(dashboard)/settings/actions";

export default function AddCustomerDialog({
  customer,
  onClose,
  onSaved,
}: {
  /** Varsa edit modu: alanlar dolu gelir, kayıt update'e gider. */
  customer?: SettingsCustomer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(
    customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") : ""
  );
  const [shopName, setShopName] = useState(customer?.shop_name ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputCls =
    "w-full h-11 px-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60";

  function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedShop = shopName.trim();
    if (!trimmedName) {
      setError(t.addCustomer.nameRequired);
      return;
    }
    if (!trimmedShop) {
      setError(t.addCustomer.shopRequired);
      return;
    }

    // Split contact name into first/last — same convention as OrderDialog.
    const parts = trimmedName.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
    const trimmedNotes = notes.trim() || undefined;

    startTransition(async () => {
      const result = customer
        ? await updateCustomerFromSettings({
            id: customer.id,
            first_name: firstName,
            last_name: lastName,
            shop_name: trimmedShop,
            notes: trimmedNotes,
          })
        : await addCustomerFromSettings({
            first_name: firstName,
            last_name: lastName,
            shop_name: trimmedShop,
            notes: trimmedNotes,
          });
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal title={customer ? t.addCustomer.editTitle : t.addCustomer.title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="px-6 py-5 space-y-4"
        noValidate
      >
        {error && (
          <div
            role="alert"
            className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-900"
          >
            {error}
          </div>
        )}
        <div>
          <label htmlFor="acu-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.addCustomer.nameLabel} <span className="text-red-500">*</span>
          </label>
          <input
            id="acu-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            maxLength={100}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="acu-shop" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.addCustomer.shopLabel} <span className="text-red-500">*</span>
          </label>
          <input
            id="acu-shop"
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            required
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="acu-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.addCustomer.notesLabel}
          </label>
          <textarea
            id="acu-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
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
          onClick={() => handleSubmit()}
          disabled={isPending}
          className="cursor-pointer h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
        >
          {isPending ? t.common.loading : t.addCustomer.save}
        </button>
      </div>
    </Modal>
  );
}
