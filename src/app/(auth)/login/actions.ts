"use server";

// ============================================================================
// Login Server Action
// ============================================================================
// Uses Supabase Auth signInWithPassword. On success, redirects to the `next`
// query param (if safe) or /catalog.
//
// Security:
//   - Input validation via Zod
//   - Rate limiting via Supabase built-in (30 attempts / 5 min per IP default)
//   - No specific error info leaked (always "ungültig" / "invalid credentials")
//   - `next` param validated to prevent open-redirect attacks
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { loginRateLimit } from "@/lib/rateLimit";

const SignInSchema = z.object({
  email: z.string().email({ message: "Ungültige E-Mail-Adresse / Geçersiz e-posta" }),
  password: z.string().min(1, { message: "Passwort erforderlich / Şifre gerekli" }),
  next: z.string().optional(),
});

export type SignInState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
};

function safeNextPath(next: string | undefined): string {
  if (!next) return "/catalog";
  // Sadece internal path'lere izin ver — open redirect saldırısını önle
  if (!next.startsWith("/") || next.startsWith("//")) return "/catalog";
  // Auth path'lerine geri gönderme
  if (next.startsWith("/login") || next.startsWith("/reset-password")) return "/catalog";
  return next;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  // Rate limit by IP (in-memory, works on Render persistent process)
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!loginRateLimit.check(ip)) {
    return { error: "Zu viele Versuche. Bitte warten. / Çok fazla deneme. Lütfen bekleyin." };
  }

  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Specific error info sızdırma — her zaman generic mesaj
    return {
      error: "Ungültige Anmeldedaten / Geçersiz giriş bilgileri",
    };
  }

  redirect(safeNextPath(parsed.data.next));
}
