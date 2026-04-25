"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePinUnlocked } from "@/lib/pinSession";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createOrderRateLimit } from "@/lib/rateLimit";
import { DEFAULT_TAX_RATE, calculateTax } from "@/lib/tax";

// ── Create Order ──
const safeImageUrl = z.string().refine(
  (val) => {
    const lower = val.toLowerCase().trim();
    return !lower.startsWith("javascript:") && !lower.startsWith("vbscript:") && !lower.startsWith("data:text/");
  },
  { message: "Invalid image URL" }
).nullable();

const OrderItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name_de: z.string().min(1, "Produktname erforderlich").max(500),
  product_image_url: safeImageUrl,
  product_sku: z.string().max(100).nullable().optional(),
  product_description: z.string().max(2000).nullable().optional(),
  quantity: z.number().int().positive().max(99_999),
  unit_price: z.number().min(0).max(1_000_000),
});

const CreateOrderSchema = z.object({
  // Optional client-generated key; same key on every retry prevents duplicates.
  idempotency_key: z.string().uuid().optional(),
  // Existing customer OR new customer fields
  customer_id: z.string().uuid().optional(),
  customer_first_name: z.string().min(1, "Name erforderlich").max(100),
  customer_last_name: z.string().max(100).optional(),
  customer_shop_name: z.string().min(1, "Firmenname erforderlich").max(200),
  notes: z.string().max(2000).optional(),
  items: z.array(OrderItemSchema).min(1, "Mindestens ein Produkt").max(500),
});

export type CreateOrderState = {
  success?: boolean;
  orderId?: string;
  error?: string;
};

export async function createOrder(input: {
  idempotency_key?: string;
  customer_id?: string;
  customer_first_name: string;
  customer_last_name?: string;
  customer_shop_name: string;
  notes?: string;
  items: {
    product_id: string;
    product_name_de: string;
    product_image_url: string | null;
    product_sku?: string | null;
    product_description?: string | null;
    quantity: number;
    unit_price: number;
  }[];
}): Promise<CreateOrderState> {
  const parsed = CreateOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  if (!createOrderRateLimit.check(user.id)) {
    return { error: "Zu viele Bestellungen — bitte einen Moment warten / Çok fazla sipariş — lütfen biraz bekleyin" };
  }

  const data = parsed.data;

  // Note: there is NO pre-flight "does this idempotency_key already exist?"
  // check here on purpose. The 23505 unique-violation branch below is the
  // only idempotency guard — a pre-check would open a TOCTOU window where
  // a second attempt could see a just-inserted orders row whose items haven't
  // been persisted yet and wrongly return success. The unique index enforces
  // single-insertion atomically at insert time.

  // Validate customer ownership if existing customer selected
  let customerId = data.customer_id;
  if (customerId) {
    const { data: ownedCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("owner_id", user.id)
      .single();
    if (!ownedCustomer) return { error: "Ungültiger Kunde" };
  }

  // If no existing customer, create one
  if (!customerId) {
    const { data: newCustomer, error: custErr } = await supabase
      .from("customers")
      .insert({
        owner_id: user.id,
        first_name: data.customer_first_name,
        last_name: data.customer_last_name || null,
        shop_name: data.customer_shop_name,
      })
      .select("id")
      .single();

    if (custErr) return { error: "Kunde konnte nicht erstellt werden" };
    customerId = newCustomer.id;
  }

  // Verify product prices against database (prevent price manipulation)
  const productIds = data.items.map((i) => i.product_id);
  const { data: dbProducts } = await supabase
    .from("products")
    .select("id, price")
    .in("id", productIds)
    .eq("owner_id", user.id);

  if (dbProducts) {
    const priceMap = new Map(dbProducts.map((p) => [p.id, p.price]));
    for (const item of data.items) {
      const dbPrice = priceMap.get(item.product_id);
      if (dbPrice !== undefined && Math.abs(dbPrice - item.unit_price) > 0.01) {
        return { error: "Produktpreis stimmt nicht überein — bitte Seite neu laden" };
      }
    }
  }

  // Generate order number
  const { data: orderNum } = await supabase.rpc("next_order_number");
  if (!orderNum) return { error: "Bestellnummer konnte nicht generiert werden" };

  // Calculate net total from verified prices, then stamp VAT.
  const net = Math.round(data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) * 100) / 100;
  const { tax, gross } = calculateTax(net, DEFAULT_TAX_RATE);

  // Create order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      owner_id: user.id,
      customer_id: customerId,
      customer_first_name: data.customer_first_name,
      customer_last_name: data.customer_last_name || null,
      customer_shop_name: data.customer_shop_name,
      order_number: orderNum,
      total: net,
      tax_rate: DEFAULT_TAX_RATE,
      tax_amount: tax,
      gross_total: gross,
      notes: data.notes || null,
      status: "confirmed",
      idempotency_key: data.idempotency_key ?? null,
    })
    .select("id")
    .single();

  if (orderErr) {
    // Concurrent retry won the race: another request with the same key already
    // inserted the order. Fetch and confirm the order is fully materialized
    // (has at least one item) before returning success — otherwise the winner
    // may be mid-rollback and returning its id would be incorrect.
    if (orderErr.code === "23505" && data.idempotency_key) {
      const { data: existing } = await supabase
        .from("orders")
        .select("id, order_items(id)")
        .eq("owner_id", user.id)
        .eq("idempotency_key", data.idempotency_key)
        .maybeSingle();
      if (existing && existing.order_items && existing.order_items.length > 0) {
        return { success: true, orderId: existing.id };
      }
      // Winner is mid-rollback or items-insert is still in flight.
      return { error: "Bestellung wird verarbeitet — bitte in ein paar Sekunden erneut versuchen" };
    }
    return { error: "Bestellung konnte nicht erstellt werden" };
  }

  // Create order items
  const orderItems = data.items.map((item, idx) => ({
    order_id: order.id,
    owner_id: user.id,
    product_id: item.product_id,
    product_name_de: item.product_name_de,
    product_image_url: item.product_image_url,
    product_sku: item.product_sku || null,
    product_description: item.product_description || null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: Math.round(item.quantity * item.unit_price * 100) / 100,
    sort_order: idx,
  }));

  const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
  if (itemsErr) {
    // Rollback: delete the order if items insertion failed
    await supabase.from("orders").delete().eq("id", order.id).eq("owner_id", user.id);
    // 23514 = check constraint violation — most commonly the stock >= -9999
    // floor on products, meaning an ordered quantity would drive inventory
    // below the sanity floor. Surface a targeted message so the owner knows
    // to recheck stock rather than blaming the items payload.
    if (itemsErr.code === "23514") {
      return { error: "Lagerbestand nicht ausreichend — Bestand prüfen" };
    }
    return { error: "Positionen konnten nicht gespeichert werden" };
  }

  revalidatePath("/orders");
  revalidatePath("/catalog");
  revalidatePath("/stock");
  // Layout-level revalidation so the sidebar low-stock badge reflects the
  // new stock on the next navigation.
  revalidatePath("/", "layout");
  return { success: true, orderId: order.id };
}

// ── Add Customer ──
const AddCustomerSchema = z.object({
  first_name: z.string().min(1, "Name erforderlich").max(100),
  last_name: z.string().max(100).optional(),
  shop_name: z.string().min(1, "Firmenname erforderlich").max(200),
});

export async function addCustomer(input: {
  first_name: string;
  last_name?: string;
  shop_name: string;
}): Promise<{ id?: string; error?: string }> {
  const parsed = AddCustomerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Ungültige Eingabe" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const { data, error } = await supabase
    .from("customers")
    .insert({
      owner_id: user.id,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name || null,
      shop_name: parsed.data.shop_name,
    })
    .select("id")
    .single();

  if (error) return { error: "Kunde konnte nicht erstellt werden" };
  return { id: data.id };
}

// ── Delete Order ──
export async function deleteOrder(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("orders");
  if (gate) return { error: "PIN erforderlich" };

  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("owner_id", user.id);

  if (error) return { error: "Löschen fehlgeschlagen" };
  revalidatePath("/orders");
  return {};
}

// ── Fetch Orders ──
export type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_first_name: string;
  customer_last_name: string | null;
  customer_shop_name: string;
  status: string;
  total: number;
  tax_rate: number;
  tax_amount: number;
  gross_total: number;
  notes: string | null;
  created_at: string;
  items: OrderItemRow[];
};

export type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name_de: string;
  product_image_url: string | null;
  product_sku: string | null;
  product_description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
};

export async function fetchOrders(): Promise<{ data?: OrderRow[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("orders");
  if (gate) return { error: "PIN erforderlich" };

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, customer_id,
      customer_first_name, customer_last_name, customer_shop_name,
      status, total, tax_rate, tax_amount, gross_total, notes, created_at,
      order_items (
        id, product_id, product_name_de, product_image_url,
        product_sku, product_description, quantity, unit_price, line_total, sort_order
      )
    `)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { error: "Bestellungen konnten nicht geladen werden" };

  const orders: OrderRow[] = (data ?? []).map((o) => ({
    ...o,
    items: (o.order_items ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }));

  return { data: orders };
}

// ── Fetch Single Order ──
export async function fetchOrderById(orderId: string): Promise<{ data?: OrderRow; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("orders");
  if (gate) return { error: "PIN erforderlich" };

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, customer_id,
      customer_first_name, customer_last_name, customer_shop_name,
      status, total, tax_rate, tax_amount, gross_total, notes, created_at,
      order_items (
        id, product_id, product_name_de, product_image_url,
        product_sku, product_description, quantity, unit_price, line_total, sort_order
      )
    `)
    .eq("id", orderId)
    .eq("owner_id", user.id)
    .single();

  if (error || !data) return { error: "Bestellung nicht gefunden" };

  return {
    data: {
      ...data,
      items: (data.order_items ?? []).sort((a, b) => a.sort_order - b.sort_order),
    },
  };
}

// ── Fetch Customers ──
export type CustomerRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  shop_name: string;
};

export async function fetchCustomers(): Promise<{ data?: CustomerRow[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  // Customer list = PII (other customers' shop names + first names visible
  // to whoever is at the counter). Gate it with the same scope as /customers
  // so a DevTools call without prior PIN entry is denied.
  const gate = await requirePinUnlocked("customers");
  if (gate) return { error: "PIN erforderlich" };

  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, shop_name")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("shop_name");

  if (error) return { error: "Kunden konnten nicht geladen werden" };
  return { data: data ?? [] };
}

// ── Fetch Customer Stats ──
export type CustomerStatRow = {
  customer_id: string;
  first_name: string;
  last_name: string | null;
  shop_name: string;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
};

export async function fetchCustomerStats(): Promise<{ data?: CustomerStatRow[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("customers");
  if (gate) return { error: "PIN erforderlich" };

  // Fetch customers
  const { data: customers, error: custErr } = await supabase
    .from("customers")
    .select("id, first_name, last_name, shop_name")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("shop_name");

  if (custErr) return { error: "Kunden konnten nicht geladen werden" };

  // Fetch orders for stats — use gross_total (incl. VAT) since that is the
  // figure the customer actually paid. Legacy rows had gross_total backfilled
  // from the old `total`, so they keep their historical amount.
  const { data: orders, error: ordErr } = await supabase
    .from("orders")
    .select("customer_id, gross_total, created_at")
    .eq("owner_id", user.id);

  if (ordErr) return { error: "Bestellungen konnten nicht geladen werden" };

  // Aggregate stats per customer
  const statsMap = new Map<string, { orderCount: number; totalSpent: number; lastOrderAt: string | null }>();
  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    const cur = statsMap.get(o.customer_id) ?? { orderCount: 0, totalSpent: 0, lastOrderAt: null };
    cur.orderCount += 1;
    cur.totalSpent += o.gross_total;
    if (!cur.lastOrderAt || cur.lastOrderAt < o.created_at) cur.lastOrderAt = o.created_at;
    statsMap.set(o.customer_id, cur);
  }

  const result: CustomerStatRow[] = (customers ?? []).map((c) => {
    const s = statsMap.get(c.id);
    return {
      customer_id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      shop_name: c.shop_name,
      order_count: s?.orderCount ?? 0,
      total_spent: s?.totalSpent ?? 0,
      last_order_at: s?.lastOrderAt ?? null,
    };
  });

  return { data: result };
}
