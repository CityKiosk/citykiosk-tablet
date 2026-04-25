// ============================================================================
// Next.js 16 client-side instrumentation entry
// ============================================================================
// Sentry.init is inlined here directly (not imported from
// sentry.client.config.ts) so the bundler sees the process.env reference
// in the entry file and inlines NEXT_PUBLIC_SENTRY_DSN at build time.
// A side-effect-only `import "../sentry.client.config"` was producing an
// empty bundle (DSN never inlined, client never constructed).
// ============================================================================

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance: sample 10% of transactions in production.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay: capture 1% of sessions, 100% on error.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],

  // Don't send errors in development.
  beforeSend(event) {
    if (process.env.NODE_ENV === "development") return null;
    return event;
  },
});

// Required export for Next.js App Router navigation instrumentation.
export { captureRouterTransitionStart as onRouterTransitionStart } from "@sentry/nextjs";
