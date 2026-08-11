"use server";

// ============================================================================
// Password Reset Confirm — Server Action
// ============================================================================
// User arrives here via /auth/callback (PKCE exchange) with a RECOVERY session
// created from the reset email, then sets a new password.
//
// Kritik-2 defense-in-depth: we verify — spoof-proof, server-side — that the
// session really is a recovery session (JWT `amr` claim) before allowing the
// change. A normally signed-in owner on the shared tablet must NOT be able to
// change the password here. The `amr` claim is inside the GoTrue-signed access
// token, so the client cannot forge it; getClaims() verifies the JWT signature
// before returning the payload.
//
// After success: sign out and redirect to /login with success message.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { passwordResetRateLimit } from "@/lib/rateLimit";
import { isRecoverySession } from "@/lib/authRecovery";
import { redirect } from "next/navigation";
import { z } from "zod";

const ConfirmSchema = z
  .object({
    password: z
      .string()
      .min(10, { message: "Mindestens 10 Zeichen / En az 10 karakter" }),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirm"],
  });

export type ConfirmResetState = {
  error?: string;
  fieldErrors?: { password?: string[]; confirm?: string[] };
};

export async function confirmPasswordReset(
  _prev: ConfirmResetState,
  formData: FormData,
): Promise<ConfirmResetState> {
  const parsed = ConfirmSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // 1. Server-validated liveness check (never getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Sitzung abgelaufen. Bitte Link erneut anfordern. / Oturum süresi doldu.",
    };
  }

  // 2. Rate limit — keyed on user.id (local-attacker threat model).
  if (!passwordResetRateLimit.check(user.id)) {
    return {
      error:
        "Zu viele Versuche. Bitte später erneut versuchen. / Çok fazla deneme. Lütfen daha sonra tekrar deneyin.",
    };
  }

  // 3. Defense-in-depth: is this actually a RECOVERY session?
  //    The `amr` claim lives in the GoTrue-signed JWT → the client cannot forge
  //    it. getClaims() verifies the signature (asymmetric: JWKS; symmetric:
  //    getUser round-trip) before returning the payload, so it is trustworthy.
  //    Fail-closed: anything but a recovery session is rejected.
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const amr = (claimsData?.claims as { amr?: unknown } | undefined)?.amr;

  if (claimsError || !isRecoverySession(amr)) {
    return {
      error:
        "Diese Aktion ist nur über den Link aus der Passwort-Reset-E-Mail möglich. / Bu işlem yalnızca parola sıfırlama e-postasındaki bağlantıyla yapılabilir.",
    };
  }

  // 4. Update. Because this is a fresh recovery session, it succeeds even with
  //    "Secure password change" (require_reauthentication) enabled — GoTrue only
  //    demands a nonce for sessions older than 24h.
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Passwort konnte nicht aktualisiert werden." };
  }

  // Sign out → force re-login with new password
  await supabase.auth.signOut();
  redirect("/login?reset=success");
}
