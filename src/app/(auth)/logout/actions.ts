"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  // Best-effort full lock (NULL scope = clear all). Session is about to be
  // invalidated anyway, but a clean slate prevents stale unlocks if the same
  // user signs back in within the 5-minute window.
  try { await supabase.rpc("lock_admin_pin", { p_scope: null }); } catch {}
  await supabase.auth.signOut();
  redirect("/login");
}
