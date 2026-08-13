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
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { loginRateLimit } from "@/lib/rateLimit";
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

function safeNextPath(next: string | undefined): string {
  if (!next) return "/catalog";
  // Nur interne Pfade zulassen. Reine startsWith("//")-Prüfung reicht NICHT:
  // "/\evil.com" beginnt mit "/" und nicht mit "//", wird vom Browser aber als
  // protokoll-relative URL zu https://evil.com aufgelöst (open redirect). Daher
  // gegen einen Dummy-Origin auflösen und verlangen, dass der Origin gleich
  // bleibt — jeder Ausbruch (//, /\, \\, absolute URL) ändert den Origin.
  let path: string;
  try {
    const u = new URL(next, "http://internal.invalid");
    if (u.origin !== "http://internal.invalid") return "/catalog";
    path = u.pathname + u.search + u.hash;
  } catch {
    return "/catalog";
  }
  if (!path.startsWith("/")) return "/catalog";
  // Nicht zurück auf Auth-Pfade schicken
  if (path.startsWith("/login") || path.startsWith("/reset-password")) return "/catalog";
  return path;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  // Rate limit by IP (in-memory, works on Render persistent process).
  // X-Forwarded-For is "client, proxy1, proxy2, ..."; the trustworthy entry
  // is the LAST hop (Render's edge), not the first (which the client controls).
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  const xffParts = xff?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const ip = xffParts.at(-1) || h.get("x-real-ip")?.trim() || "unknown";
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
