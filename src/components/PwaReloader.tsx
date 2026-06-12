"use client";

import { useEffect, useRef } from "react";

/**
 * Detects when a PWA comes back to foreground after being backgrounded.
 * iOS Safari kills the web view after ~30s in background.
 * When the user reopens the app, the page may be stale/blank.
 * This component auto-reloads if the page was hidden for too long.
 */
export default function PwaReloader() {
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else {
        // If hidden for more than 2 minutes, reload to get fresh content.
        // SwRegister da görünürlükte update tetikliyor — bekleyen bir SW
        // update varsa reload'u ona bırak, yoksa çifte reload (iki flaş) olur.
        const staleEnough =
          hiddenAt.current && Date.now() - hiddenAt.current > 2 * 60 * 1000;
        hiddenAt.current = null;
        if (staleEnough) {
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker
              .getRegistration()
              .then((reg) => {
                if (reg?.installing || reg?.waiting) return; // SW update reload'u devralacak
                window.location.reload();
              })
              .catch(() => window.location.reload());
          } else {
            window.location.reload();
          }
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return null;
}
