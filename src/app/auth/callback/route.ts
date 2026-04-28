// ============================================================================
// Auth Callback — /auth/callback
// ============================================================================
// Handles OAuth redirects AND email link callbacks (e.g., password reset).
// Exchanges the code in the query string for a session, then redirects.
//
// Used by:
//   - Password reset email: user clicks link → lands here → redirects to /reset-password/confirm
//   - (Future) OAuth providers, magic links
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/catalog";

  // Behind Render's proxy, request.url's origin can resolve to the internal
  // host (localhost:10000). Use NEXT_PUBLIC_SITE_URL as the public origin.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_failed`);
  }

  // Safe redirect — only allow internal paths
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/catalog";
  return NextResponse.redirect(`${baseUrl}${safeNext}`);
}
