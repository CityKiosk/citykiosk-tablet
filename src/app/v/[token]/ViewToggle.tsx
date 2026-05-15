"use client";

// ViewToggle — switches the public catalog between flipbook and mobile-list
// renderings. Single icon shows the destination (the OTHER view), so:
//   - in flipbook view → smartphone icon (tap → list)
//   - in list view     → gallery/spread icon (tap → flipbook)
//
// Click persists the choice in localStorage under VIEW_PREF_KEY so the next
// visit honors the override even when UA detection would route the user
// somewhere else. Honors `?view=...` URL params for shop-owner debugging.

import { useRouter } from "next/navigation";
import { SmartphoneIcon, GalleryHorizontalIcon } from "@/components/icons";

export const VIEW_PREF_KEY = "souvenir_public_view";
export type ViewPref = "flipbook" | "list";

export default function ViewToggle({
  current,
  token,
  className,
}: {
  current: ViewPref;
  token: string;
  className?: string;
}) {
  const router = useRouter();
  const other: ViewPref = current === "flipbook" ? "list" : "flipbook";
  const target = other === "list" ? `/v/${token}/m` : `/v/${token}?view=flipbook`;

  const label =
    other === "list"
      ? "Mobile Listenansicht öffnen"
      : "Katalog-Ansicht öffnen";

  const onClick = () => {
    try {
      localStorage.setItem(VIEW_PREF_KEY, other);
    } catch {}
    router.push(target);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        className ??
        "w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
      }
    >
      {other === "list" ? (
        <SmartphoneIcon width={18} height={18} />
      ) : (
        <GalleryHorizontalIcon width={18} height={18} />
      )}
    </button>
  );
}
