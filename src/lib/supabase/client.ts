// ============================================================================
// Supabase Browser Client
// ============================================================================
// Used in:
//   - Client Components ("use client")
//   - Client-side event handlers
//   - Realtime subscriptions (if any)
//   - Supabase Storage direct uploads
//
// NEVER used in:
//   - Server Components (use ./server.ts instead)
//   - Server Actions (use ./server.ts instead)
//   - Route Handlers (use ./server.ts instead)
//
// Uses the public anon key — safe to expose to browser. RLS protects data.
// ============================================================================

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
