import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addPendingOrder,
  getPendingOrders,
  incrementRetry,
  processPendingOrders,
  removePendingOrder,
  type PendingOrder,
} from "./orderQueue";

const QUEUE_KEY = "souvenir_pending_orders";

function basePayload(overrides: Partial<PendingOrder["payload"]> = {}): Omit<PendingOrder["payload"], "idempotency_key"> {
  return {
    customer_first_name: "Max",
    customer_shop_name: "Berliner Andenken GmbH",
    items: [
      {
        product_id: "11111111-1111-1111-1111-111111111111",
        product_name_de: "Berlin Magnet",
        product_image_url: null,
        quantity: 5,
        unit_price: 1.19,
      },
    ],
    ...overrides,
  };
}

describe("addPendingOrder", () => {
  it("generates an idempotency_key when none is provided", () => {
    addPendingOrder(basePayload());
    const list = getPendingOrders();
    expect(list).toHaveLength(1);
    expect(list[0].payload.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(list[0].retryCount).toBe(0);
  });

  it("preserves a caller-provided idempotency_key (offline replay safety)", () => {
    const key = "00000000-0000-4000-8000-000000000001";
    addPendingOrder({ ...basePayload(), idempotency_key: key });
    expect(getPendingOrders()[0].payload.idempotency_key).toBe(key);
  });

  it("appends additional orders without dropping the existing queue", () => {
    addPendingOrder(basePayload({ customer_first_name: "A" }));
    addPendingOrder(basePayload({ customer_first_name: "B" }));
    const list = getPendingOrders();
    expect(list).toHaveLength(2);
    expect(list[0].payload.customer_first_name).toBe("A");
    expect(list[1].payload.customer_first_name).toBe("B");
  });
});

describe("getPendingOrders — 24h expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters out orders older than 24 hours", () => {
    addPendingOrder(basePayload({ customer_first_name: "Stale" }));
    // Jump forward 25 hours → first order expires
    vi.setSystemTime(new Date("2026-05-16T13:00:00Z"));
    addPendingOrder(basePayload({ customer_first_name: "Fresh" }));

    const list = getPendingOrders();
    expect(list).toHaveLength(1);
    expect(list[0].payload.customer_first_name).toBe("Fresh");
  });

  it("keeps orders that are exactly under 24h", () => {
    addPendingOrder(basePayload());
    // Jump 23h59m forward — still inside the window
    vi.setSystemTime(new Date("2026-05-16T11:59:00Z"));
    expect(getPendingOrders()).toHaveLength(1);
  });

  it("persists the expiry pruning so subsequent reads do not re-do work", () => {
    addPendingOrder(basePayload());
    vi.setSystemTime(new Date("2026-05-16T13:00:00Z"));
    getPendingOrders(); // first read prunes
    // Raw localStorage should reflect the prune so a fresh tab does not see expired PII
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    expect(raw).toHaveLength(0);
  });
});

describe("getPendingOrders — legacy backfill", () => {
  it("injects a fresh idempotency_key into pre-migration entries", () => {
    // Simulate a queue persisted before idempotency_key was introduced
    const legacy = [{
      id: "legacy-1",
      payload: { ...basePayload() } as Record<string, unknown>,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    }];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(legacy));

    const list = getPendingOrders();
    expect(list).toHaveLength(1);
    expect(typeof list[0].payload.idempotency_key).toBe("string");
    expect(list[0].payload.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns [] when localStorage holds garbage instead of throwing", () => {
    localStorage.setItem(QUEUE_KEY, "{not json");
    expect(getPendingOrders()).toEqual([]);
  });
});

describe("removePendingOrder / incrementRetry", () => {
  it("removePendingOrder drops only the matching id", () => {
    const id1 = addPendingOrder(basePayload({ customer_first_name: "Keep" }));
    const id2 = addPendingOrder(basePayload({ customer_first_name: "Drop" }));
    removePendingOrder(id2);
    const list = getPendingOrders();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id1);
  });

  it("incrementRetry bumps the counter on the matching entry only", () => {
    const id1 = addPendingOrder(basePayload({ customer_first_name: "A" }));
    addPendingOrder(basePayload({ customer_first_name: "B" }));
    incrementRetry(id1);
    incrementRetry(id1);
    const list = getPendingOrders();
    expect(list.find((o) => o.id === id1)?.retryCount).toBe(2);
    expect(list.find((o) => o.id !== id1)?.retryCount).toBe(0);
  });
});

describe("processPendingOrders — idempotency replay safety", () => {
  it("removes orders that succeed on retry and keeps idempotency_key stable across calls", async () => {
    const id = addPendingOrder(basePayload());
    const keyAtQueueTime = getPendingOrders().find((o) => o.id === id)!.payload.idempotency_key;

    const createOrder = vi.fn().mockResolvedValue({ success: true });
    const processed = await processPendingOrders(createOrder);

    expect(processed).toBe(1);
    expect(getPendingOrders()).toHaveLength(0);
    // Same idempotency_key used in the actual createOrder call — proves
    // a replayed network blip cannot generate a second stock decrement.
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: keyAtQueueTime }),
    );
  });

  it("on createOrder error response, bumps retryCount and leaves the order queued", async () => {
    const id = addPendingOrder(basePayload());
    const createOrder = vi.fn().mockResolvedValue({ error: "boom" });

    const processed = await processPendingOrders(createOrder);

    expect(processed).toBe(0);
    const list = getPendingOrders();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id);
    expect(list[0].retryCount).toBe(1);
  });

  it("skips orders that have already hit MAX_RETRIES (3) without calling createOrder", async () => {
    const id = addPendingOrder(basePayload());
    incrementRetry(id);
    incrementRetry(id);
    incrementRetry(id); // retryCount = 3

    const createOrder = vi.fn().mockResolvedValue({ success: true });
    const processed = await processPendingOrders(createOrder);

    expect(processed).toBe(0);
    expect(createOrder).not.toHaveBeenCalled();
    // Stays in queue for manual handling, not silently discarded
    expect(getPendingOrders()).toHaveLength(1);
  });

  it("treats a thrown createOrder (network drop) as a retry, not a success", async () => {
    const id = addPendingOrder(basePayload());
    const createOrder = vi.fn().mockRejectedValue(new Error("offline"));

    const processed = await processPendingOrders(createOrder);

    expect(processed).toBe(0);
    expect(getPendingOrders().find((o) => o.id === id)?.retryCount).toBe(1);
  });
});
