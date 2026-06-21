"use client";

import { useState, useTransition } from "react";
import Modal from "./Modal";
import PinPad from "./PinPad";
import { useI18n } from "./I18nProvider";
import {
  deleteCustomerFromSettings,
  type SettingsCustomer,
} from "@/app/(dashboard)/settings/actions";

/**
 * Lager-PIN-Gate vor dem Löschen eines Kunden. Die PIN-Eingabe IST die
 * Bestätigung (kein separater ConfirmDialog). Ein einziger Server-Call
 * verifiziert die Lager-PIN UND löscht (soft) atomar — falsche PIN → Shake +
 * erneuter Versuch, korrekte PIN → onDeleted.
 *
 * Vorbedingung: Aufrufer (Settings) öffnet diesen Dialog nur, wenn eine
 * Lager-PIN existiert (stockPinExists === true); der Server erzwingt das
 * zusätzlich (lager_pin_required).
 */
export default function DeleteCustomerPinDialog({
  customer,
  onClose,
  onDeleted,
}: {
  customer: SettingsCustomer;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [errorKey, setErrorKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleComplete(pin: string) {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await deleteCustomerFromSettings({ id: customer.id, pin });
      if (res.success) {
        onDeleted();
        return;
      }
      // Jeder Fehler leert + schüttelt den Pad (errorKey) für einen neuen Versuch.
      setErrorKey((k) => k + 1);
      if (res.error === "rate_limited") {
        setErrorMsg(t.pin.tooManyAttempts);
      } else if (res.error === "wrong_pin" || res.error === "invalid_format") {
        setErrorMsg(t.pin.incorrect);
      } else {
        // lager_pin_required (sollte clientseitig nicht passieren) / internal / …
        setErrorMsg(t.pin.saveError);
      }
    });
  }

  // Während der laufende Lösch-Request (isPending) NICHT schließbar: sonst
  // läuft das Server-Soft-Delete durch, aber onDeleted feuert nicht und die
  // Liste bleibt bis zum nächsten Reload veraltet.
  function handleClose() {
    if (isPending) return;
    onClose();
  }

  return (
    <Modal title={t.addCustomer.deletePinTitle} onClose={handleClose}>
      <div className="px-6 py-6">
        <PinPad
          onComplete={handleComplete}
          errorKey={errorKey}
          disabled={isPending}
          label={t.addCustomer.deletePinPrompt(customer.shop_name)}
        />
        {errorMsg && (
          <p role="alert" className="mt-5 text-center text-sm text-red-600 dark:text-red-400">
            {errorMsg}
          </p>
        )}
      </div>
    </Modal>
  );
}
