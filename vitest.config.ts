import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Browser-only modules (Next/Server, Sentry, Supabase clients) are not
    // expected from these unit tests — they cover pure logic + DOM-bound
    // utilities (localStorage, contexts).
    setupFiles: ["./vitest.setup.ts"],
  },
});
