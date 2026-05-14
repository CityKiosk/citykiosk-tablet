// Fresh localStorage between tests — without this, the order-queue tests
// would leak state across files and the cart-store cross-tab test would
// pick up stale payloads.
import { beforeEach } from "vitest";

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {}
});
