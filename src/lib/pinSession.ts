// ============================================================================
// PIN session helpers — server-side gate for admin server actions.
// ============================================================================
// Threat model: shared tablet. Owner is signed in; customer borrowing the
// tablet must NOT be able to fire admin mutations from DevTools just because
// they share the auth session — even if the owner unlocked a different
// admin screen earlier. Each gated screen has its OWN scope; unlocking
// /settings does not cascade to /stock, /orders, or /customers.
//
// Every gated server action calls `requirePinUnlocked(scope)` after
// `getUser()`. On success the unlock window is extended (sliding TTL) so an
// active session stays unlocked while idle tablets self-lock.
//
// Window length: 5 minutes (configured in the verify/extend RPCs). Aligns
// with IdleLock so the failure modes are easy to reason about.
// ============================================================================

import { createClient } from "@/lib/supabase/server";

/** All admin scopes guarded by the PIN. Adding a new one requires an RPC
 *  migration too — see verify_admin_pin's `IF p_scope NOT IN (...)` list. */
export type PinScope = "settings" | "stock" | "orders" | "customers";

/** Returned by gated server actions when the PIN window has lapsed. The UI
 *  recognises this code and re-renders the PinGate prompt. */
export const PIN_LOCKED_ERROR = "pin_locked" as const;

export type PinGateError = { error: typeof PIN_LOCKED_ERROR | "unauthenticated" };

/**
 * Server-side gate for admin actions. Call after `getUser()` has
 * authenticated the request. Returns null on success (caller proceeds), or
 * an error object the caller should return verbatim to the client.
 *
 * Side effect on success: slides this scope's TTL forward by 5 minutes.
 */
export async function requirePinUnlocked(scope: PinScope): Promise<PinGateError | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const { data: unlocked, error } = await supabase.rpc("is_admin_pin_unlocked", { p_scope: scope });
  if (error || !unlocked) return { error: PIN_LOCKED_ERROR };

  // Sliding extend — fire-and-forget. If this fails we still allow the action
  // (the gate already passed); the worst case is a slightly shorter window.
  await supabase.rpc("extend_admin_pin_unlock", { p_scope: scope });
  return null;
}

/** Lightweight read used by PinGate to decide setupNew vs unlock mode. The
 *  unlocked field is intentionally not consulted by PinGate — the pinpad
 *  always renders on screen entry per threat model. */
export async function getPinStatus(scope: PinScope): Promise<{
  authenticated: boolean;
  pinExists: boolean;
  unlocked: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authenticated: false, pinExists: false, unlocked: false };

  const [hasPinRes, unlockedRes] = await Promise.all([
    supabase.rpc("has_admin_pin"),
    supabase.rpc("is_admin_pin_unlocked", { p_scope: scope }),
  ]);

  return {
    authenticated: true,
    pinExists: !!hasPinRes.data,
    unlocked: !!unlockedRes.data,
  };
}
