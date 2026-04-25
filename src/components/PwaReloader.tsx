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
        // If hidden for more than 2 minutes, reload to get fresh content
        if (hiddenAt.current && Date.now() - hiddenAt.current > 2 * 60 * 1000) {
          window.location.reload();
        }
        hiddenAt.current = null;
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return null;
}
