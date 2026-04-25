"use server";

import { createClient } from "@/lib/supabase/server";

export async function getOrCreateShareLink(): Promise<{ token?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

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
