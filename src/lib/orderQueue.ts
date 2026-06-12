/**
 * Order retry queue — saves failed createOrder payloads to localStorage.
 * When the browser comes back online, pending orders are retried automatically.
 */

const QUEUE_KEY = "souvenir_pending_orders";

/** Fired on window whenever the pending queue is mutated (add/remove).
 *  Sidebar listens to this to keep the "waiting orders" badge live. */
export const QUEUE_CHANGED_EVENT = "souvenir_pending_orders_changed";

function notifyQueueChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

export type PendingOrder = {
  id: string;
  payload: {
    // idempotency_key is generated once when the order enters the queue and is
    // reused on every retry. createOrder() writes it to orders.idempotency_key
    // (unique per owner) so a network-partition replay cannot create a second
    // order — which would otherwise trigger a second stock decrement.
    idempotency_key: string;
    customer_id?: string;
    customer_first_name: string;
    customer_last_name?: string;
    customer_shop_name: string;
    notes?: string;
    discount_pct?: number;
    items: {
      product_id: string;
      product_name_de: string;
      product_image_url: string | null;
      product_sku?: string | null;
      product_description?: string | null;
      quantity: number;
      unit_price: number;
    }[];
  };
  createdAt: string;
  retryCount: number;
};

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours — auto-expire stale PII

export function getPendingOrders(): PendingOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const all: PendingOrder[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    // Auto-expire orders older than 24h to limit PII retention in localStorage
    const now = Date.now();
    const fresh = all.filter((o) => now - new Date(o.createdAt).getTime() < MAX_AGE_MS);
    // Backfill idempotency_key for entries queued before the idempotency migration.
    // Without this, replays of pre-upgrade queue items would create duplicate
    // orders and (via the order_items stock trigger) duplicate stock decrements.
    let mutated = fresh.length !== all.length;
    for (const entry of fresh) {
      if (!entry.payload || typeof entry.payload.idempotency_key !== "string") {
        entry.payload = {
          ...entry.payload,
          idempotency_key: crypto.randomUUID(),
        };
        mutated = true;
      }
    }
    if (mutated) {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(fresh));
    }
    return fresh;
  } catch {
    return [];
  }
}

export function addPendingOrder(
  payload: Omit<PendingOrder["payload"], "idempotency_key"> & { idempotency_key?: string },
): string {
  const pending: PendingOrder = {
    id: crypto.randomUUID(),
    payload: {
      ...payload,
      idempotency_key: payload.idempotency_key ?? crypto.randomUUID(),
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  const list = getPendingOrders();
  list.push(pending);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  notifyQueueChanged();
  return pending.id;
}

export function removePendingOrder(id: string) {
  const list = getPendingOrders().filter((o) => o.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  notifyQueueChanged();
}

export function incrementRetry(id: string) {
  const list = getPendingOrders().map((o) =>
    o.id === id ? { ...o, retryCount: o.retryCount + 1 } : o
  );
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

const MAX_RETRIES = 3;

/**
 * Process all pending orders. Call this on 'online' event or on app mount.
 * Returns the number of successfully processed orders.
 */
export async function processPendingOrders(
  createOrder: (payload: PendingOrder["payload"]) => Promise<{ success?: boolean; error?: string }>
): Promise<number> {
  const pending = getPendingOrders();
  if (pending.length === 0) return 0;

  let processed = 0;
  for (const order of pending) {
    if (order.retryCount >= MAX_RETRIES) {
      // Give up after max retries — leave in queue for manual handling
      continue;
    }
    try {
      const result = await createOrder(order.payload);
      if (result.success) {
        removePendingOrder(order.id);
        processed++;
      } else {
        incrementRetry(order.id);
      }
    } catch {
      incrementRetry(order.id);
    }
  }
  return processed;
}
