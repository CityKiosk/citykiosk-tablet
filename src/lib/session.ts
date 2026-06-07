// ============================================================================
// App session cookie — concurrent-login limit (max 2 devices).
// ============================================================================
// Holds the app-session id that maps to a public.app_sessions row. Separate
// from Supabase's own auth cookies: this one is what middleware validates via
// touch_session() to enforce the device cap. httpOnly so client JS can't read
// or forge it.
// ============================================================================

export const SESSION_COOKIE = "souvenir_sid";

// 30 days. The cookie merely carries the id; actual validity is governed by
// the app_sessions row (reaped after 12h idle) and the Supabase session, so an
// outliving cookie just gets rejected by touch_session → forced re-login.
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
