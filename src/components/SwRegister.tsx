"use client";

import { useEffect } from "react";

// Watches for service-worker updates and reloads once when a new worker takes
// over. Critical for tablet/PWA users who can't discover a "hard refresh"
// gesture — new deploys reach them automatically on tab focus.
export default function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | null = null;
    let reloaded = false;

    function handleUpdateFound() {
      if (!registration) return;
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // When the new worker becomes 'activated' AND there was a previous
        // controller (i.e. this is an update, not a first install), do a
        // single silent reload so the fresh bundle takes over.
        if (
          installing.state === "activated" &&
          navigator.serviceWorker.controller &&
          !reloaded
        ) {
          reloaded = true;
          window.location.reload();
        }
      });
    }

    async function onLoad() {
      try {
        registration = await navigator.serviceWorker.register("/sw.js");
        registration.addEventListener("updatefound", handleUpdateFound);
        // Ask the browser to check for a new sw.js immediately and on each
        // tab re-focus. Without this the browser re-checks at most every
        // 24h, so a deploy can sit unapplied for a full day on an active
        // tablet install.
        registration.update().catch(() => {});
        function onVisible() {
          if (document.visibilityState === "visible") {
            registration?.update().catch(() => {});
          }
        }
        document.addEventListener("visibilitychange", onVisible);
      } catch (err) {
        console.warn("[sw] register failed", err);
      }
    }

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}
