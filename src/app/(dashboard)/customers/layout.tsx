"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import PageHeader from "@/components/PageHeader";
import PinGate from "@/components/PinGate";
import IdleLock, { ADMIN_IDLE_LOCK_MS } from "@/components/IdleLock";
import { lockPin } from "@/app/(dashboard)/settings/actions";

// Per-page unlock key. Each admin page has its own key — see StockClient
// for rationale (prevents cross-page leak when the tablet is handed over).
const UNLOCK_KEY = "souvenir_admin_unlocked_customers";

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {}
    setChecked(true);
    // Lock on navigation away.
    return () => {
      try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
    };
  }, []);

  if (!checked) return null;

  if (!unlocked) {
    return (
      <div>
        <PageHeader title={t.customers.title} />
        <PinGate
          unlockTitle={t.pin.unlockTitleOrders}
          sessionKey={UNLOCK_KEY}
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
          // Server lock so a DevTools attacker on a freshly unattended tablet
          // can't fire admin actions during the slack between idle-expire and
          // the next PIN prompt.
          void lockPin();
          setUnlocked(false);
        }}
      />
      {children}
    </>
  );
}
