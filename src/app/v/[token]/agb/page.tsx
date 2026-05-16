// ============================================================================
// Public AGB Page — Allgemeine Geschäftsbedingungen on the shared catalog
// ============================================================================
// Permanent, shareable URL for the legal text. German B2B law (§ 305 BGB
// read together with § 310 Abs. 1 BGB) demands a "zumutbare Möglichkeit
// der Kenntnisnahme" — a dedicated page satisfies that because it is
// printable, bookmark-able, and links naturally from the catalog footer.
//
// Token validity is checked via the same RPC the catalog uses, so a
// revoked share link also blocks access to the AGB page (consistent UX).
// ============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LegalPage from "@/components/LegalPage";
import { ChevronLeftIcon } from "@/components/icons";
import SessionThemeToggle from "../_components/SessionThemeToggle";
import { getPublicCatalog } from "../_data/catalog";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "AGB — Sock Off Berlin Souvenirs GmbH",
  description: "Allgemeine Geschäftsbedingungen der Sock Off Berlin Souvenirs GmbH.",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicAgbPage({ params }: PageProps) {
  const { token } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) notFound();

  const data = await getPublicCatalog(token);
  if (!data) notFound();

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div className="h-12 flex items-center justify-between gap-2 px-2">
          <Link
            href={`/v/${token}/m`}
            aria-label="Zurück zum Katalog"
            className="flex-shrink-0 inline-flex items-center gap-1 h-9 px-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
          >
            <ChevronLeftIcon width={18} height={18} />
            <span>Katalog</span>
          </Link>
          <SessionThemeToggle />
        </div>
      </header>

      <main className="pb-12">
        <LegalPage variant="mobile" />
      </main>
    </div>
  );
}
