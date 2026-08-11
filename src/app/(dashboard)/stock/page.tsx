// ============================================================================
// Stock Page — Server Component
// ============================================================================
// Auth-checked shell → StockClient (password-gated, admin-only).
//
// WICHTIG: Bestandsdaten werden hier NICHT server-seitig geladen. Sonst
// lägen Bestand/Preis im RSC-Payload, bevor die PinGate im Client mountet —
// mit DevTools ohne Lager-PIN auslesbar. Stattdessen holt StockClient die
// Daten nach dem PIN-Unlock client-seitig über das gegatete
// fetchStockProducts (gleiches Muster wie /orders, /customers, /settings).
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StockClient } from "./StockClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stok · Souvenirs Berlin",
  robots: { index: false, follow: false },
};

export default async function StockPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  return <StockClient />;
}
