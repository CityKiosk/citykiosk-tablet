// ============================================================================
// Reset Password Request Page — /reset-password/request
// ============================================================================
// Entry point for forgotten password flow. User enters email → receives link.
// ============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { RequestResetForm } from "./RequestResetForm";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen · Souvenirs Berlin",
  description: "Passwort zurücksetzen",
  robots: { index: false, follow: false },
};

export default function RequestResetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Passwort zurücksetzen · Şifre sıfırla
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Bitte geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link.
        </p>
      </div>

      <RequestResetForm />

      <div className="text-center text-sm">
        <Link
          href="/login"
          className="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          ← Zurück zum Login · Girişe dön
        </Link>
      </div>
    </div>
  );
}
