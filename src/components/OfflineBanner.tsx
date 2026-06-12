"use client";

import { useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";
import { WifiOffIcon } from "./icons";

/**
 * Persistent offline indicator — stays visible the entire time the device is
 * offline (the transient toast in OnlineStatus is easy to miss on flaky shop
 * wifi). Renders nothing while online; sits in-flow under the header so it
 * never covers content.
 */
export default function OfflineBanner() {
  const { t } = useI18n();
  // Start as online (matches SSR output), correct on mount.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-950/80 border-b border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold"
    >
      <WifiOffIcon width={14} height={14} className="flex-shrink-0" />
      <span>{t.common.offlineBanner}</span>
    </div>
  );
}
