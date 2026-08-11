// ============================================================================
// Supabase Middleware Helper — updateSession
// ============================================================================
// Called from src/middleware.ts on EVERY request.
// Responsibilities:
//   1. Refresh Supabase auth session (cookies → new cookies if needed)
//   2. Gate protected routes: redirect unauthenticated users to /login
//   3. Redirect authenticated users away from /login to /catalog
//
// Security:
//   - Uses getUser() (server-validated JWT), NEVER getSession()
//   - Cookie options inherited from request response
// ============================================================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'
import { SESSION_COOKIE } from '@/lib/session'
import { isRecoverySession } from '@/lib/authRecovery'

// Login olmadan erişilebilecek path'ler
const PUBLIC_PATHS = ['/login', '/reset-password/request', '/reset-password/confirm', '/auth/callback', '/api/health', '/v']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Fast path: skip Supabase entirely for health checks (uptime pings)
  // Avoids wasting Supabase auth quota on cron-job.org pings.
  if (pathname === '/api/health') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: getUser() → server-validated. NEVER use getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Concurrent-login limit: validate this device's app-session on every
  // authenticated request to a protected path. touch_session returns false if
  // the slot was reaped (12h idle) or evicted — or if no sid cookie exists
  // (e.g. a session predating this feature). In all those cases sign the
  // device out so it can't bypass the 2-device cap with a still-valid JWT.
  // /login is public so we skip it here (the redirect below handles it).
  if (user && !isPublicPath(pathname)) {
    const sid = request.cookies.get(SESSION_COOKIE)?.value
    let valid = false
    if (sid) {
      const { data } = await supabase.rpc('touch_session', { p_sid: sid })
      valid = data === true
    }
    if (!valid) {
      // A password-reset (recovery) session has NO app-session slot: it's minted
      // by the email link (exchangeCodeForSession), not login/register_session.
      // Signing it out here — e.g. when the (auth) layout's "/" prefetch hits
      // this guard — kills the recovery session before the user can submit the
      // new password ("Sitzung abgelaufen"). Detect it via the GoTrue-signed amr
      // claim (same trust basis as confirmPasswordReset) and, instead of signing
      // out, confine it to the confirm page while KEEPING its cookies.
      const { data: claimsData } = await supabase.auth.getClaims()
      const amr = (claimsData?.claims as { amr?: unknown } | undefined)?.amr
      if (isRecoverySession(amr)) {
        const url = request.nextUrl.clone()
        url.pathname = '/reset-password/confirm'
        const redirectResponse = NextResponse.redirect(url)
        // Carry any refreshed auth cookies (no signOut → session stays alive).
        supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c))
        return redirectResponse
      }

      // Normal (amr=password) session with no valid slot → existing behaviour.
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      // Carry the cleared auth cookies (set by signOut via the adapter) onto
      // the redirect response, then drop the stale session cookie.
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c))
      redirectResponse.cookies.delete(SESSION_COOKIE)
      return redirectResponse
    }
  }

  // Authenticated user visiting /login → redirect to /catalog
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/catalog'
    return NextResponse.redirect(url)
  }

  // Unauthenticated user visiting protected route
  if (!user && !isPublicPath(pathname)) {
    // Dashboard routes → redirect to login (admin knows these)
    const dashboardPaths = ['/catalog', '/orders', '/settings', '/customers', '/browse']
    const isDashboard = dashboardPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

    if (isDashboard) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    // Everything else → 404 (don't reveal login page to public visitors)
    const url = request.nextUrl.clone()
    url.pathname = '/_not-found'
    return NextResponse.rewrite(url)
  }

  // IMPORTANT: Return supabaseResponse — never create a new NextResponse().
  // If you need custom headers, call supabaseResponse.headers.set(...) instead.
  return supabaseResponse
}
