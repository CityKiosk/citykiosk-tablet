// ============================================================================
// Next.js Middleware — Runs on every request (edge runtime by default)
// ============================================================================
// Responsibilities:
//   1. Refresh Supabase auth session cookies
//   2. Protect non-public routes (redirect to /login if not authenticated)
//   3. Apply security headers (CSP, HSTS, X-Frame-Options, etc.)
//
// Matcher excludes static assets, image optimization, and favicons —
// those don't need auth or security header work.
// ============================================================================

import { updateSession } from '@/lib/supabase/middleware'
import type { NextRequest } from 'next/server'

function applySecurityHeaders(response: import('next/server').NextResponse, isDev: boolean) {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  )
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  )
  // Sentry: regional ingest hosts can be *.ingest.sentry.io OR
  // *.ingest.<region>.sentry.io (e.g. de.sentry.io for EU). CSP wildcards
  // only match a single label, so both patterns must be listed explicitly.
  // Sentry Replay also spawns a Web Worker via blob:, hence worker-src.
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    `worker-src 'self' blob:`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.supabase.co`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ')
  response.headers.set('Content-Security-Policy', csp)
}

export async function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'

  // 1. Auth session refresh + route gating
  const response = await updateSession(request)

  // 2. Security headers (applied to ALL responses including /api/health)
  applySecurityHeaders(response, isDev)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, fonts, etc.)
     * - manifest.webmanifest (PWA manifest)
     * - sw.js (service worker)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
