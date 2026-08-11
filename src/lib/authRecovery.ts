// ============================================================================
// Recovery-session detection — GoTrue `amr` claim
// ============================================================================
// Shared by confirmPasswordReset (amr-gate) and the middleware session guard,
// so "count as recovery" and "let the reset through" use ONE definition and
// can never drift apart.
//
// The `amr` (Authentication Methods References) claim lives inside the
// GoTrue-signed JWT → the client cannot forge it. Read it via getClaims(),
// which verifies the signature before returning the payload.
// ============================================================================

// GoTrue treats these AMR methods as "recovery" (models.AuthenticationMethod
// .IsRecovery: OTP, MagicLink, Recovery). The app uses password login only, so
// these methods can only appear on a session that came from a reset/OTP email —
// never a normal login.
export const RECOVERY_AMR_METHODS = new Set(["recovery", "otp", "magiclink"]);

export function isRecoverySession(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;
  // amr format: AMREntry[] ({ method, timestamp }) OR string[] (RFC-8176).
  return amr.some((entry) => {
    const method =
      typeof entry === "string"
        ? entry
        : typeof entry === "object" && entry !== null
          ? (entry as { method?: unknown }).method
          : undefined;
    return typeof method === "string" && RECOVERY_AMR_METHODS.has(method);
  });
}
