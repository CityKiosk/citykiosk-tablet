"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "./I18nProvider";
import { useToast } from "./Toast";
import { getPendingOrders, processPendingOrders } from "@/lib/orderQueue";
import { createOrder } from "@/app/(dashboard)/orders/actions";

const THROTTLE_MS = 10_000; // Min 10 sn aralık

export default function OnlineStatus() {
  const { t } = useI18n();
  const toast = useToast();
  const wasOffline = useRef(false);
  const lastToast = useRef(0);

  useEffect(() => {
    function throttledToast(msg: string) {
      const now = Date.now();
      if (now - lastToast.current < THROTTLE_MS) return;
      lastToast.current = now;
      toast.show(msg);
    }

    function handleOffline() {
      wasOffline.current = true;
      throttledToast(t.connection.offline);
    }

    async function handleOnline() {
      if (wasOffline.current) {
        wasOffline.current = false;
        throttledToast(t.connection.backOnline);
      }

      const pending = getPendingOrders();
      if (pending.length > 0) {
        const processed = await processPendingOrders(createOrder);
        if (processed > 0) {
          toast.show(t.connection.sent(processed));
        }
        // Warn about stuck orders that exceeded max retries
        const remaining = getPendingOrders();
        const stuck = remaining.filter((o) => o.retryCount >= 3);
        if (stuck.length > 0) {
          toast.show(t.connection.failed(stuck.length), "error");
        }
      }
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (navigator.onLine && getPendingOrders().length > 0) {
      handleOnline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [t, toast]);

  return null;
}
