"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import PageHeader from "@/components/PageHeader";
import PinGate from "@/components/PinGate";
import IdleLock, { ADMIN_IDLE_LOCK_MS } from "@/components/IdleLock";
import { lockPin } from "@/app/(dashboard)/settings/actions";

// Per-page unlock key. Each admin page has its own key — see StockClient
// for rationale (prevents cross-page leak when the tablet is handed over).
const UNLOCK_KEY = "souvenir_admin_unlocked_orders";

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {}
    setChecked(true);
    return () => {
      try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
      void lockPin("orders");
    };
  }, []);

  // Avoid a flash of protected content on first paint before sessionStorage
  // is read.
  if (!checked) return null;

  if (!unlocked) {
    return (
      <div>
        <PageHeader title={t.orders.listTitle} />
        <PinGate
          unlockTitle={t.pin.unlockTitleOrders}
          sessionKey={UNLOCK_KEY}
          scope="orders"
          onUnlocked={() => setUnlocked(true)}
        />
      </div>
    );
  }

  return (
    <>
      <IdleLock
        timeoutMs={ADMIN_IDLE_LOCK_MS}
        onExpire={() => {
          try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
          void lockPin("orders");
          setUnlocked(false);
        }}
      />
      {children}
    </>
  );
}
