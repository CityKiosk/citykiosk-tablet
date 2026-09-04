"use server";

// ============================================================================
// Login Server Action
// ============================================================================
// Uses Supabase Auth signInWithPassword. On success, redirects to the `next`
// query param (if safe) or /catalog.
//
// Security:
//   - Input validation via Zod
//   - Rate limiting: in-memory per client IP AND per target e-mail, plus
//     Supabase Auth's own limits
//   - No specific error info leaked (always "ungültig" / "invalid credentials")
//   - `next` param validated to prevent open-redirect attacks
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { getClientIp, loginEmailRateLimit, loginRateLimit } from "@/lib/rateLimit";
import { safeNextPath } from "@/lib/safeNextPath";
import { SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from "@/lib/session";

const SignInSchema = z.object({
  email: z.string().email({ message: "Ungültige E-Mail-Adresse / Geçersiz e-posta" }),
  password: z.string().min(1, { message: "Passwort erforderlich" }),
  next: z.string().optional(),
});

export type SignInState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
};


export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  // Rate limit by IP (in-memory, works on Render persistent process). IP
  // derivation lives in getClientIp — see the note there on which headers are
  // trustworthy behind Render/Cloudflare.
  const ip = getClientIp(await headers());
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

  // Second key: FAILED attempts against the TARGET account. IP keys can be
  // rotated or spoofed; the account name cannot. Only failures count and a
  // successful login clears the bucket, so this cannot be used to lock the
  // owner out (see loginEmailRateLimit).
  const emailKey = parsed.data.email.trim().toLowerCase();
  if (loginEmailRateLimit.isLimited(emailKey)) {
    return { error: "Zu viele Versuche. Bitte warten. / Çok fazla deneme. Lütfen bekleyin." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    loginEmailRateLimit.hit(emailKey);
    // Specific error info sızdırma — her zaman generic mesaj
    return {
      error: "Ungültige Anmeldedaten / Geçersiz giriş bilgileri",
    };
  }
  loginEmailRateLimit.reset(emailKey);

  // Concurrent-login limit: at most 6 active device sessions. register_session
  // atomically reaps stale rows, counts, and inserts a slot — or returns false
  // when 6 are already active.
  const cookieStore = await cookies();
  // Reuse this device's existing session id when present, so re-login from the
  // same device keeps its slot (register_session treats a known sid as a no-op
  // touch) instead of burning a 2nd slot and locking out a real 2nd device.
  const existingSid = cookieStore.get(SESSION_COOKIE)?.value;
  const sid =
    existingSid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingSid)
      ? existingSid
      : crypto.randomUUID();

  const { data: granted, error: regError } = await supabase.rpc("register_session", { p_sid: sid });
  // Distinguish a real DB/RPC failure (e.g. migration not yet applied) from a
  // genuine limit-reached. Both fail closed — we revoke the session we just
  // created — but the message must not mislead.
  if (regError) {
    await supabase.auth.signOut();
    return {
      error: "Anmeldung fehlgeschlagen, bitte erneut versuchen.",
    };
  }
  if (!granted) {
    await supabase.auth.signOut();
    return {
      error:
        "Maximal 6 Geräte gleichzeitig angemeldet — bitte auf einem anderen Gerät abmelden. / Aynı anda en fazla 6 cihaz açık olabilir — lütfen başka bir cihazdan çıkış yapın.",
    };
  }

  cookieStore.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });

  redirect(safeNextPath(parsed.data.next));
}
