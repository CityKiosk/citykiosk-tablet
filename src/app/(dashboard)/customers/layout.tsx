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
    // Server state is the source of truth — sessionStorage is intentionally
    // not consulted on mount (a stale client flag could bypass the pinpad
    // after a server-side reset).
    setChecked(true);
    return () => {
      try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
      // Lock on navigation away — both client gate (sessionStorage) AND
      // server-side scope. Without the server lock, a customer with brief
      // tablet access could re-enter /customers within the 5-min window
      // and the server would still accept admin actions.
      void lockPin("customers");
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
          scope="customers"
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
          // Server lock for THIS scope only — leaving other scopes' (e.g.
          // /settings) windows alone if the owner is mid-session there in
          // another tab.
          void lockPin("customers");
          setUnlocked(false);
        }}
      />
      {children}
    </>
  );
}
