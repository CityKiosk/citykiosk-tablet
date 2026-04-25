"use server";

// ============================================================================
// Password Reset Confirm — Server Action
// ============================================================================
// User arrives here via auth callback with a valid session (from reset email).
// They set a new password via supabase.auth.updateUser.
// After success: sign out and redirect to /login with success message.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
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
    message: "Passwörter stimmen nicht überein / Şifreler eşleşmiyor",
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

  // Must have an active session (from the reset email link)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sitzung abgelaufen. Bitte Link erneut anfordern. / Oturum süresi doldu." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Passwort konnte nicht aktualisiert werden. / Şifre güncellenemedi." };
  }

  // Sign out → force re-login with new password
  await supabase.auth.signOut();
  redirect("/login?reset=success");
}
