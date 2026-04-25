// ============================================================================
// (dashboard) Layout — Protected Area
// ============================================================================
// Wraps all authenticated pages with CartProvider + AppShell (sidebar + nav).
// Middleware handles auth check — unauthenticated users never reach this layout.
// CartProvider is here (not root) because cart state is only used within
// authenticated dashboard routes.
// ============================================================================

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import BackToTop from "@/components/BackToTop";
import CartFab from "@/components/CartFab";
import OnlineStatus from "@/components/OnlineStatus";
import { CartProvider } from "@/lib/cartStore";
import { DisplayFieldsProvider } from "@/components/DisplayFieldsProvider";
import { fetchDisplayFields } from "@/app/(dashboard)/settings/actions";
import { fetchLowStockCount } from "@/app/(dashboard)/stock/actions";
import PwaReloader from "@/components/PwaReloader";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defense-in-depth: don't rely solely on middleware for auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const [initialDisplayFields, lowStockCount] = await Promise.all([
    fetchDisplayFields(),
    fetchLowStockCount(),
  ]);

  return (
    <CartProvider>
      <DisplayFieldsProvider initial={initialDisplayFields}>
        <AppShell lowStockCount={lowStockCount}>{children}</AppShell>
        <CartFab />
        <BackToTop />
        <OnlineStatus />
        <PwaReloader />
      </DisplayFieldsProvider>
    </CartProvider>
  );
}
