// ============================================================================
// Next.js 16 instrumentation entry (server + edge)
// ============================================================================
// Sentry 10+ no longer auto-loads the legacy sentry.server.config.ts /
// sentry.edge.config.ts files — the Next.js convention moved to
// `src/instrumentation.ts` with an exported `register` function. We
// re-use the existing config files to avoid duplication.
// ============================================================================

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
