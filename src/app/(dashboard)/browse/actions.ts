"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePinUnlocked } from "@/lib/pinSession";

// Share-Link-Verwaltung ist eine Owner-Aktion (Settings-PIN), obwohl der
// Button auf dem kundenseitigen /browse lebt. RLS erzwingt den PIN zusätzlich
// DB-seitig (Migration 20260905010000) — hier ist das App-Gate + der
// Widerruf. Der PIN wird vom ShareLinkDialog vor diesen Calls entsperrt.

export async function getOrCreateShareLink(): Promise<{ token?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("settings");
  if (gate) return { error: "pin_required" };

  // Check for existing active share
  const { data: existing } = await supabase
    .from("catalog_shares")
    .select("token")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { token: existing.token };

  // Create new share
  const { data: created, error } = await supabase
    .from("catalog_shares")
    .insert({ owner_id: user.id })
    .select("token")
    .single();

  if (error) return { error: "Link konnte nicht erstellt werden" };
  return { token: created.token };
}

/** Deaktiviert ALLE aktiven Share-Links des Owners (is_active=false). Der
 *  Token wird ungültig → /v/<token> liefert nichts mehr (get_public_catalog
 *  filtert auf is_active=true). Settings-PIN erforderlich. */
export async function revokeShareLink(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("settings");
  if (gate) return { error: "pin_required" };

  const { error } = await supabase
    .from("catalog_shares")
    .update({ is_active: false })
    .eq("owner_id", user.id)
    .eq("is_active", true);

  if (error) return { error: "Widerruf fehlgeschlagen" };
  return { success: true };
}
