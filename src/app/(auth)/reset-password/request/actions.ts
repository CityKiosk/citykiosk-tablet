"use server";

// ============================================================================
// Password Reset Request — Server Action
// ============================================================================
// Sends a password reset email via Supabase Auth + Resend SMTP.
// Always returns success (even if email doesn't exist) to prevent user
// enumeration attacks.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const RequestSchema = z.object({
  email: z.string().email({ message: "Ungültige E-Mail-Adresse / Geçersiz e-posta" }),
});

export type RequestResetState = {
  success?: boolean;
  fieldErrors?: { email?: string[] };
};

export async function requestPasswordReset(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const parsed = RequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // Always return success regardless of whether email exists — prevents
  // user enumeration. Supabase handles the "no such user" case silently.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password/confirm`,
  });

  return { success: true };
}
