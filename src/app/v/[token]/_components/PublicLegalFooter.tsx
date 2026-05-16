// ============================================================================
// PublicLegalFooter — company line + AGB link shown on the public catalog
// ============================================================================
// Renders on every page of the mobile public catalog so the legal text is
// reachable from anywhere. The line itself (company name + "AGB" link) acts
// as the explicit "Hinweis" required for § 305 BGB style incorporation in
// the B2B catalog phase; the link target is a permanent shareable URL,
// which is what German case law treats as a "zumutbare Möglichkeit der
// Kenntnisnahme".
//
// View-only: no commercial CTAs, no contact, no Impressum block. The shop
// is wholesale-only and reaches customers off-channel before they ever
// open this catalog — a full Impressum here would mismatch the intent of
// the shared link and is not legally required for a non-publishing share.
// ============================================================================

import Link from "next/link";

export default function PublicLegalFooter({ token }: { token: string }) {
  return (
    <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 px-3 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
      <div className="font-medium text-slate-600 dark:text-slate-300">
        Sock Off Berlin Souvenirs GmbH
      </div>
      <div className="mt-1.5">
        <Link
          href={`/v/${token}/agb`}
          className="underline underline-offset-2 hover:text-sky-700 dark:hover:text-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded"
        >
          Allgemeine Geschäftsbedingungen (AGB)
        </Link>
      </div>
    </footer>
  );
}
