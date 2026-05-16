"use client";

// ============================================================================
// useScrollRestoration — preserve window scroll across navigation
// ============================================================================
// Pairs with useCatalogListState. The state hook restores WHICH products are
// in the list; this hook restores WHERE the customer was within that list.
// Without it, going back from /p/[id] would jump to the top even though the
// filter and visibleCount say "you were scrolled 5 rows down".
//
// Saves on every scroll (rAF-throttled) so we always have the latest Y even
// if the customer navigates away abruptly (e.g. tapping a product link).
// Restores once on mount.
// ============================================================================

import { useEffect, useRef } from "react";

function storageKey(token: string) {
  return `souvenir_public_scroll:${token}`;
}

function isBackNavigation(): boolean {
  if (typeof performance === "undefined") return false;
  const entries = performance.getEntriesByType("navigation");
  const first = entries[0] as PerformanceNavigationTiming | undefined;
  return first?.type === "back_forward";
}

export function useScrollRestoration(token: string, ready: boolean) {
  const restoredRef = useRef(false);

  // Restore on mount, but only AFTER the consumer says it's ready (data has
  // hydrated + DOM has the right height). Otherwise the saved Y would be
  // clipped because the document is still short.
  //
  // Only back/forward navigations restore — reloads and direct visits start
  // at the top, matching the customer's expectation that "opening the link
  // again" feels fresh.
  useEffect(() => {
    if (!ready || restoredRef.current) return;
    if (!isBackNavigation()) {
      try {
        sessionStorage.removeItem(storageKey(token));
      } catch {}
      restoredRef.current = true;
      return;
    }
    try {
      const raw = sessionStorage.getItem(storageKey(token));
      if (!raw) {
        restoredRef.current = true;
        return;
      }
      const y = Number(raw);
      if (Number.isFinite(y) && y > 0) {
        window.scrollTo({ top: y, behavior: "auto" });
      }
    } catch {}
    restoredRef.current = true;
  }, [token, ready]);

  useEffect(() => {
    let frame = 0;
    const handler = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        try {
          sessionStorage.setItem(storageKey(token), String(window.scrollY));
        } catch {}
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [token]);
}
