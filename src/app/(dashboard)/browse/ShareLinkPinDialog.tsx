"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import PinPad from "@/components/PinPad";
import { useI18n } from "@/components/I18nProvider";
import { verifyPin } from "@/app/(dashboard)/settings/actions";
import { getOrCreateShareLink } from "./actions";

/**
 * Settings-PIN-Gate vor dem Erstellen eines öffentlichen Katalog-Links.
 * Der Teilen-Button lebt auf dem kundenseitigen /browse — ohne diesen Gate
 * könnte jeder das Tablet nehmen und einen permanenten öffentlichen Link
 * erzeugen. verifyPin('settings') entsperrt das Scope (5-Min-Fenster), womit
 * die anschließende RLS-geschützte INSERT in getOrCreateShareLink durchgeht.
 * Ein einziger Flow: PIN → Link. Falsche PIN → Shake + neuer Versuch.
 */
export default function ShareLinkPinDialog({
  onClose,
  onReady,
}: {
  onClose: () => void;
  onReady: (url: string) => void;
}) {
  const { t } = useI18n();
  const [errorKey, setErrorKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleComplete(pin: string) {
    setErrorMsg(null);
    startTransition(async () => {
      const verified = await verifyPin(pin, "settings");
      if (verified.error) {
        setErrorKey((k) => k + 1);
        setErrorMsg(
          verified.error === "rate_limited" ? t.pin.tooManyAttempts : t.pin.incorrect,
        );
        return;
      }
      // PIN ok → 'settings' ist jetzt entsperrt → Link erstellen/holen.
      const result = await getOrCreateShareLink();
      if (result.error || !result.token) {
        setErrorKey((k) => k + 1);
        setErrorMsg(
          result.error === "pin_required" ? t.browse.share.pinRequired : t.pin.saveError,
        );
        return;
      }
      onReady(`${window.location.origin}/v/${result.token}`);
    });
  }

  function handleClose() {
    if (isPending) return;
    onClose();
  }

  return (
    <Modal title={t.pin.unlockTitleSettings} onClose={handleClose}>
      <div className="px-6 py-6">
        <PinPad
          onComplete={handleComplete}
          errorKey={errorKey}
          disabled={isPending}
          label={t.pin.unlockSubtitle}
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
