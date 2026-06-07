"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

export async function signOut() {
  const supabase = await createClient();
  // Best-effort full lock (NULL scope = clear all). Session is about to be
  // invalidated anyway, but a clean slate prevents stale unlocks if the same
  // user signs back in within the 5-minute window.
  try { await supabase.rpc("lock_admin_pin", { p_scope: null }); } catch {}

  // Free this device's slot in the concurrent-login limit so it's available
  // immediately, instead of waiting for the 12h stale reaper.
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (sid) {
    try { await supabase.from("app_sessions").delete().eq("id", sid); } catch {}
    cookieStore.delete(SESSION_COOKIE);
  }

  await supabase.auth.signOut();
  redirect("/login");
}
