"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  // Best-effort lock — the session is about to be invalidated anyway, but
  // clearing the unlock timestamp keeps the next sign-in clean.
  try { await supabase.rpc("lock_admin_pin"); } catch {}
  await supabase.auth.signOut();
  redirect("/login");
}
