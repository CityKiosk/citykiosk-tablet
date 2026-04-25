"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "./I18nProvider";
import { useToast } from "./Toast";
import { getPendingOrders, processPendingOrders } from "@/lib/orderQueue";
import { createOrder } from "@/app/(dashboard)/orders/actions";

const THROTTLE_MS = 10_000; // Min 10 sn aralık

export default function OnlineStatus() {
  const { locale } = useI18n();
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
      throttledToast(
        locale === "de"
          ? "Keine Internetverbindung"
          : "Internet bağlantısı yok"
      );
    }

    async function handleOnline() {
      if (wasOffline.current) {
        wasOffline.current = false;
        throttledToast(
          locale === "de"
            ? "Wieder online"
            : "Tekrar çevrimiçi"
        );
      }

      const pending = getPendingOrders();
      if (pending.length > 0) {
        const processed = await processPendingOrders(createOrder);
        if (processed > 0) {
          toast.show(
            locale === "de"
              ? `${processed} ausstehende Bestellung(en) gesendet`
              : `${processed} bekleyen sipariş gönderildi`
          );
        }
        // Warn about stuck orders that exceeded max retries
        const remaining = getPendingOrders();
        const stuck = remaining.filter((o) => o.retryCount >= 3);
        if (stuck.length > 0) {
          toast.show(
            locale === "de"
              ? `${stuck.length} Bestellung(en) konnten nicht gesendet werden`
              : `${stuck.length} sipariş gönderilemedi`
          );
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
  }, [locale, toast]);

  return null;
}
