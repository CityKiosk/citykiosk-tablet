import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true,
  },
  // Without this, the client Router Cache can serve a stale RSC payload after
  // a server action invalidates server-side data — e.g. updating stock and
  // then clicking the Lager link in the sidebar would show the old numbers
  // until the cache aged out.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
