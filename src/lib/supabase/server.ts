// ============================================================================
// Supabase Server Client
// ============================================================================
// Used in:
//   - Server Components (async)
//   - Server Actions ("use server")
//   - Route Handlers (app/api/*)
//
// NEVER used in:
//   - Client Components
//   - Middleware (use ./middleware.ts instead)
//
// Reads auth session from request cookies. RLS enforces data access.
// Each request gets a fresh client instance (bound to that request's cookies).
// ============================================================================

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // `setAll` from a Server Component throws — that's fine as long as
            // we have middleware refreshing user sessions.
          }
        },
      },
    },
  )
}
