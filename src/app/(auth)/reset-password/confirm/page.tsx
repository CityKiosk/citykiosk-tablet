// ============================================================================
// Reset Password Confirm Page — /reset-password/confirm
// ============================================================================
// User arrives here via auth callback with an active session from the reset
// email link. They set a new password, then sign out and re-login.
// ============================================================================

import type { Metadata } from "next";
import { ConfirmResetForm } from "./ConfirmResetForm";

export const metadata: Metadata = {
  title: "Neues Passwort · Souvenirs Berlin",
  description: "Passwort zurücksetzen bestätigen",
  robots: { index: false, follow: false },
};

export default function ConfirmResetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Neues Passwort
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Bitte geben Sie Ihr neues Passwort ein. Mindestens 10 Zeichen.
        </p>
      </div>

      <ConfirmResetForm />
    </div>
  );
}
