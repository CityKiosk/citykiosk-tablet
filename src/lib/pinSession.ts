// ============================================================================
// PIN session helpers — server-side gate for admin server actions.
// ============================================================================
// Threat model: shared tablet. Owner is signed in; customer borrowing the
// tablet should not be able to fire admin mutations from DevTools just because
// they share the auth session. Client-side PinGate (sessionStorage) is bypass-
// able. The real check is `profiles.admin_pin_unlocked_until > now()`, set
// by verify_admin_pin / set_admin_pin RPCs and consumed here.
//
// Every gated server action calls `requirePinUnlocked()` after `getUser()`.
// On success the unlock window is extended (sliding TTL) so an active session
// stays unlocked while idle tablets self-lock.
// ============================================================================

import { createClient } from "@/lib/supabase/server";

/** Returned by gated server actions when the PIN window has lapsed. The UI
 *  recognises this code and re-renders the PinGate prompt. */
export const PIN_LOCKED_ERROR = "pin_locked" as const;

export type PinGateError = { error: typeof PIN_LOCKED_ERROR | "unauthenticated" };

/**
 * Server-side gate for admin actions. Call after `getUser()` has authenticated
 * the request. Returns null on success (caller proceeds), or an error object
 * the caller should return verbatim to the client.
 *
 * Side effect on success: slides the TTL forward by another 4 hours.
 */
export async function requirePinUnlocked(): Promise<PinGateError | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const { data: unlocked, error } = await supabase.rpc("is_admin_pin_unlocked");
  if (error || !unlocked) return { error: PIN_LOCKED_ERROR };

  // Sliding extend — fire-and-forget. If this fails we still allow the action
  // (the gate already passed); the worst case is a slightly shorter window.
  await supabase.rpc("extend_admin_pin_unlock");
  return null;
}

/** Lightweight read used by PinGate to skip the pinpad if the server has
 *  already accepted a recent PIN entry. */
export async function getPinStatus(): Promise<{
  authenticated: boolean;
  pinExists: boolean;
  unlocked: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authenticated: false, pinExists: false, unlocked: false };

  const [hasPinRes, unlockedRes] = await Promise.all([
    supabase.rpc("has_admin_pin"),
    supabase.rpc("is_admin_pin_unlocked"),
  ]);

  return {
    authenticated: true,
    pinExists: !!hasPinRes.data,
    unlocked: !!unlockedRes.data,
  };
}
