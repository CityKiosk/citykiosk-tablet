"use server";

import { createClient } from "@/lib/supabase/server";
import { pinSetRateLimit, pinVerifyRateLimit } from "@/lib/rateLimit";
import { requirePinUnlocked, getPinStatus as getPinStatusHelper, type PinScope } from "@/lib/pinSession";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const PinScopeSchema = z.enum(["settings", "stock", "orders", "customers"]);
import {
  DISPLAY_FIELD_DEFAULTS,
  DISPLAY_FIELDS_BY_SCOPE_DEFAULTS,
  type DisplayFields,
  type DisplayFieldScope,
  type DisplayFieldsByScope,
} from "@/lib/displayFields";

const DisplayFieldKeySchema = z.enum([
  "name",
  "description",
  "sku",
  "dimensions",
  "price",
  "packagingUnit",
]);

const DisplayFieldScopeSchema = z.enum(["catalog", "browse"]);

function normaliseFields(raw: unknown): DisplayFields {
  if (!raw || typeof raw !== "object") return DISPLAY_FIELD_DEFAULTS;
  return { ...DISPLAY_FIELD_DEFAULTS, ...(raw as Partial<DisplayFields>) };
}

/** Fetches both catalog + browse configs in one round-trip.
 *  Called from the (dashboard) layout on each request. */
export async function fetchDisplayFields(): Promise<DisplayFieldsByScope> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DISPLAY_FIELDS_BY_SCOPE_DEFAULTS;

  const { data } = await supabase
    .from("profiles")
    .select("display_fields_catalog, display_fields_browse")
    .eq("id", user.id)
    .maybeSingle();

  return {
    catalog: normaliseFields(data?.display_fields_catalog),
    browse: normaliseFields(data?.display_fields_browse),
  };
}

export async function updateDisplayField(
  scope: DisplayFieldScope,
  key: keyof DisplayFields,
  value: boolean,
): Promise<{ success?: boolean; error?: string }> {
  const parsedScope = DisplayFieldScopeSchema.safeParse(scope);
  if (!parsedScope.success) return { error: "Invalid scope" };

  const parsedKey = DisplayFieldKeySchema.safeParse(key);
  if (!parsedKey.success) return { error: "Invalid field" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("settings");
  if (gate) return { error: "PIN erforderlich" };

  // Partial merge via Postgres jsonb concat operator (avoids race conditions
  // when two devices toggle different keys concurrently).
  const { error } = await supabase.rpc("update_display_field", {
    p_scope: parsedScope.data,
    p_key: parsedKey.data,
    p_value: value,
  });

  if (error) return { error: "Speichern fehlgeschlagen" };

  revalidatePath("/", "layout");
  return { success: true };
}

/** Server-side PIN status used by PinGate. Returns whether PIN exists and
 *  whether the unlock window for the given scope is currently active. */
export async function getPinStatus(scope: PinScope) {
  if (!PinScopeSchema.safeParse(scope).success) {
    return { authenticated: false, pinExists: false, unlocked: false };
  }
  return getPinStatusHelper(scope);
}

/** Explicit lock for a single scope. Called by IdleLock and the layout
 *  cleanup hook on navigation away. Pass `null` (or omit) to clear all
 *  scopes — used on logout. */
export async function lockPin(scope?: PinScope | null): Promise<{ success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  if (scope && !PinScopeSchema.safeParse(scope).success) return {};
  await supabase.rpc("lock_admin_pin", { p_scope: scope ?? null });
  return { success: true };
}

// ----------------------------------------------------------------------------
// Admin PIN — replaces password re-auth for /settings + /stock gates.
// Error codes (not strings) let the client translate; never surface raw DB
// errors. Rate limit is per-IP across verify + set.
// ----------------------------------------------------------------------------

export type PinErrorCode =
  | "unauthenticated"
  | "rate_limited"
  | "invalid_format"
  | "wrong_pin"
  | "mismatch"
  | "internal";

const PinSchema = z.string().regex(/^[0-9]{6}$/);

// Scopes that can carry their own hash. "default" is the master/admin PIN
// (always required). "stock" is the only optional override today; widening
// this list means a code change here + a corresponding RPC update.
const PinHashScopeSchema = z.enum(["default", "stock"]);
export type PinHashScope = z.infer<typeof PinHashScopeSchema>;

export async function hasPin(
  scope: PinHashScope = "default",
): Promise<{ exists?: boolean; error?: PinErrorCode }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  if (!PinHashScopeSchema.safeParse(scope).success) return { error: "invalid_format" };

  // The default scope keeps using the no-arg RPC for backwards compatibility
  // with PinGate's existing call sites; non-default scopes go through the
  // per-scope RPC.
  if (scope === "default") {
    const { data, error } = await supabase.rpc("has_admin_pin");
    if (error) return { error: "internal" };
    return { exists: !!data };
  }
  const { data, error } = await supabase.rpc("has_admin_pin_for_scope", {
    p_scope: scope,
  });
  if (error) return { error: "internal" };
  return { exists: !!data };
}

export async function verifyPin(pin: string, scope: PinScope): Promise<{ success?: boolean; error?: PinErrorCode }> {
  // Auth first — rate-limit key is user.id so anonymous attempts can't even
  // register against a bucket (handled by getUser bailout below).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  // Per-scope rate bucket so a Lager-PIN brute force can't lock the owner
  // out of /settings (and vice versa).
  if (!pinVerifyRateLimit.check(`${user.id}:${scope}`)) {
    return { error: "rate_limited" };
  }

  if (!PinSchema.safeParse(pin).success) {
    return { error: "invalid_format" };
  }

  if (!PinScopeSchema.safeParse(scope).success) {
    return { error: "invalid_format" };
  }

  const { data, error } = await supabase.rpc("verify_admin_pin", { p_pin: pin, p_scope: scope });
  if (error) return { error: "internal" };
  if (!data) return { error: "wrong_pin" };
  return { success: true };
}

export async function setPin(
  currentPin: string | null,
  newPin: string,
  scope: PinHashScope = "default",
): Promise<{ success?: boolean; error?: PinErrorCode }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  if (!PinHashScopeSchema.safeParse(scope).success) return { error: "invalid_format" };
  if (!pinSetRateLimit.check(`${user.id}:set:${scope}`)) {
    return { error: "rate_limited" };
  }

  if (!PinSchema.safeParse(newPin).success) {
    return { error: "invalid_format" };
  }
  if (currentPin !== null && !PinSchema.safeParse(currentPin).success) {
    return { error: "invalid_format" };
  }

  // Defense in depth: refuse to set a non-default scope PIN before the admin
  // PIN exists. The RPC enforces the same invariant — this guard short-
  // circuits before we burn a rate-limit slot or hit the DB on an obviously
  // invalid call (e.g. an attacker probing the RPC directly).
  if (scope !== "default") {
    const adminCheck = await hasPin("default");
    if (!adminCheck.exists) return { error: "wrong_pin" };
  }

  const { data, error } = await supabase.rpc("set_admin_pin", {
    p_current_pin: currentPin,
    p_new_pin: newPin,
    p_scope: scope,
  });
  if (error) return { error: "internal" };
  if (!data) return { error: "wrong_pin" };
  return { success: true };
}

/** Removes a per-scope override (currently only "stock"). The admin/master
 *  PIN can never be removed via this path — to "remove" the default PIN the
 *  owner has to rotate it instead. Authorization: caller supplies the
 *  current admin PIN. */
export async function removePin(
  adminPin: string,
  scope: Exclude<PinHashScope, "default">,
): Promise<{ success?: boolean; error?: PinErrorCode }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  if (!pinSetRateLimit.check(`${user.id}:remove:${scope}`)) {
    return { error: "rate_limited" };
  }
  if (!PinSchema.safeParse(adminPin).success) return { error: "invalid_format" };
  if (scope !== "stock") return { error: "invalid_format" };

  const { data, error } = await supabase.rpc("remove_admin_pin", {
    p_admin_pin: adminPin,
    p_scope: scope,
  });
  if (error) return { error: "internal" };
  if (!data) return { error: "wrong_pin" };
  return { success: true };
}
