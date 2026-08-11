// ============================================================================
// (auth) Layout — Public/Unauthenticated Area
// ============================================================================
// Minimal layout for login + password reset pages. No AppShell, no CartProvider.
// Just a centered card on a gradient background with the brand mark at top.
// ============================================================================

import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 dark:from-slate-950 dark:via-sky-950/20 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" prefetch={false} className="inline-block">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Souvenirs Berlin
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Großhandel · Bestellverwaltung
            </p>
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} Souvenirs Berlin · Internal Tool
        </p>
      </div>
    </main>
  );
}
