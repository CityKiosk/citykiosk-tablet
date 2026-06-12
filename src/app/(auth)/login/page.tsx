// ============================================================================
// Login Page — /login
// ============================================================================
// Server Component wrapping a client LoginForm.
// `next` query param preserves destination for post-login redirect.
// ============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Anmelden · Souvenirs Berlin",
  description: "Interner Login",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;

  return (
    <div className="space-y-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-192.png" alt="Souvenirs Berlin" width={64} height={64} className="mx-auto" />
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Anmelden
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Mit E-Mail und Passwort anmelden.
        </p>
      </div>

      <LoginForm next={next} />

      <div className="text-center text-sm">
        <Link
          href="/reset-password/request"
          className="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Passwort vergessen?
        </Link>
      </div>
    </div>
  );
}
