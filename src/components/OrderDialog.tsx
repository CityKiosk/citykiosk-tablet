"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import PinPad from "./PinPad";
import { useI18n } from "./I18nProvider";
import { OrderItem } from "@/lib/types";
import { formatPrice } from "@/lib/i18n";
import { useToast } from "./Toast";
import {
  createOrder,
  fetchCustomers,
  type CustomerRow,
} from "@/app/(dashboard)/orders/actions";
import { verifyPin, type PinErrorCode } from "@/app/(dashboard)/settings/actions";
import { addPendingOrder } from "@/lib/orderQueue";

function pinErrorMessage(code: PinErrorCode, t: ReturnType<typeof useI18n>["t"]): string {
  switch (code) {
    case "wrong_pin":
    case "invalid_format":
      return t.pin.incorrect;
    case "rate_limited":
      return t.pin.tooManyAttempts;
    default:
      return t.pin.saveError;
  }
}

export default function OrderDialog({
  items,
  total,
  onClose,
  onSaved,
}: {
  items: OrderItem[];
  total: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Gate the dialog behind a PIN — otherwise the customer holding the
  // tablet would see the shop's full customer list in the "Bestehender
  // Kunde" dropdown. No session reuse: this PIN is re-asked every time
  // the dialog opens, because the owner always has to consent to revealing
  // PII in front of whoever is at the tablet.
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinErrorKey, setPinErrorKey] = useState(0);
  const [pinPending, setPinPending] = useState(false);

  useEffect(() => {
    // Only fetch the customer list once the PIN is verified — defence in
    // depth, so an unverified viewer can't snoop the list via DevTools /
    // network tab even if the UI would hide it.
    if (!pinVerified) return;
    fetchCustomers().then((res) => {
      if (res.data) setCustomers(res.data);
      setLoadingCustomers(false);
    });
  }, [pinVerified]);

  async function handleVerifyPin(pin: string) {
    setPinPending(true);
    setPinError(null);
    const result = await verifyPin(pin);
    setPinPending(false);
    if (result.error) {
      setPinError(pinErrorMessage(result.error, t));
      setPinErrorKey((k) => k + 1);
      return;
    }
    setPinVerified(true);
  }

  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.shop_name.localeCompare(b.shop_name, locale)),
    [customers, locale]
  );
  const [mode, setMode] = useState<"select" | "new">("new");
  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Once customers load, set defaults
  useEffect(() => {
    if (!loadingCustomers && customers.length > 0) {
      setMode("select");
      setSelectedId(sortedCustomers[0]?.id || "");
    }
  }, [loadingCustomers, customers.length, sortedCustomers]);

  const inputCls =
    "w-full h-11 px-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let customerFirstName: string;
    let customerLastName: string | undefined;
    let customerShopName: string;
    let customerId: string | undefined;

    if (mode === "new") {
      if (!name.trim() || !shopName.trim()) {
        setError(t.order.reqErr);
        return;
      }
      // Split name into first/last
      const parts = name.trim().split(/\s+/);
      customerFirstName = parts[0];
      customerLastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
      customerShopName = shopName.trim();
    } else {
      const customer = customers.find((c) => c.id === selectedId);
      if (!customer) {
        setError(t.order.pickErr);
        return;
      }
      customerId = customer.id;
      customerFirstName = customer.first_name;
      customerLastName = customer.last_name ?? undefined;
      customerShopName = customer.shop_name;
    }

    const orderItems = items.map((i) => ({
      product_id: i.productId,
      product_name_tr: i.productNameTr || i.productName,
      product_name_de: i.productNameDe ?? null,
      product_image_url: i.productImage || null,
      product_sku: i.productSku ?? null,
      product_description: i.productDescription ?? null,
      quantity: i.quantity,
      unit_price: i.price,
    }));

    const orderPayload = {
      // Generated once at submit; reused on retry so offline queue replays cannot
      // create duplicate orders (and therefore duplicate stock decrements).
      idempotency_key: crypto.randomUUID(),
      customer_id: customerId,
      customer_first_name: customerFirstName,
      customer_last_name: customerLastName,
      customer_shop_name: customerShopName,
      items: orderItems,
    };

    startTransition(async () => {
      try {
        const result = await createOrder(orderPayload);

        if (result.error) {
          // If offline or server error, queue for retry
          if (!navigator.onLine) {
            addPendingOrder(orderPayload);
            toast.show(locale === "de"
              ? "Offline — Bestellung wird gesendet, sobald Sie wieder online sind"
              : "Çevrimdışı — bağlantı geldiğinde sipariş gönderilecek");
            onSaved();
            return;
          }
          setError(result.error);
          return;
        }

        toast.show(t.order.saved);
        onSaved();
        router.push(`/orders/${result.orderId}`);
      } catch {
        // Network error — queue for retry
        addPendingOrder(orderPayload);
        toast.show(locale === "de"
          ? "Offline — Bestellung wird gesendet, sobald Sie wieder online sind"
          : "Çevrimdışı — bağlantı geldiğinde sipariş gönderilecek");
        onSaved();
      }
    });
  }

  if (!pinVerified) {
    return (
      <Modal title={t.order.title} onClose={onClose} size="lg">
        <div className="px-6 py-8 flex flex-col items-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6">
            {t.pin.unlockSubtitle}
          </p>
          {pinError && (
            <div
              role="alert"
              className="mb-4 w-full max-w-sm px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-900 text-center"
            >
              {pinError}
            </div>
          )}
          <PinPad
            onComplete={handleVerifyPin}
            disabled={pinPending}
            errorKey={pinErrorKey}
          />
          {pinPending && (
            <p className="mt-4 text-xs text-center text-slate-500 dark:text-slate-400">
              {t.pin.verifying}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t.order.title} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" noValidate>
        {error && (
          <div
            id="order-error"
            role="alert"
            aria-live="assertive"
            className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-900"
          >
            {error}
          </div>
        )}

        {loadingCustomers ? (
          <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        ) : (
          <>
            {customers.length > 0 && (
              <div
                className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-full"
                role="group"
                aria-label={t.order.modeLabel}
              >
                <button
                  type="button"
                  aria-pressed={mode === "select"}
                  onClick={() => setMode("select")}
                  className={`cursor-pointer flex-1 h-9 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                    mode === "select"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {t.order.existing}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "new"}
                  onClick={() => setMode("new")}
                  className={`cursor-pointer flex-1 h-9 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                    mode === "new"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {t.order.new}
                </button>
              </div>
            )}

            {mode === "select" ? (
              <div>
                <label htmlFor="om-customer" className="sr-only">
                  {t.order.selectCustomer}
                </label>
                <select
                  id="om-customer"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className={inputCls}
                >
                  {sortedCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shop_name} — {c.first_name}{c.last_name ? ` ${c.last_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label={t.order.authorizedName} required htmlFor="om-name">
                  <input
                    id="om-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputCls}
                  />
                </Field>
                <Field label={t.order.shopName} required htmlFor="om-shop">
                  <input
                    id="om-shop"
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    required
                    className={inputCls}
                  />
                </Field>
              </div>
            )}
          </>
        )}

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            {t.order.summary}
          </h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {items.map((i) => (
              <li key={i.productId} className="flex items-center gap-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.productImage}
                  alt=""
                  width={36}
                  height={36}
                  loading="lazy"
                  className="w-9 h-9 rounded-md object-cover bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700"
                />
                <div className="flex-1 min-w-0 text-slate-700 dark:text-slate-300">
                  <span className="truncate block">{i.productName} <span className="tabular text-slate-500">× {i.quantity}</span></span>
                  {i.productDescription && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">{i.productDescription}</span>
                  )}
                  {i.productSku && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Art.-Nr. {i.productSku}</span>
                  )}
                </div>
                <div className="tabular text-slate-900 dark:text-slate-100 font-medium flex-shrink-0">
                  {formatPrice(i.price * i.quantity, locale)}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-baseline mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t.order.total}</span>
            <span className="tabular text-xl font-semibold text-slate-900 dark:text-slate-50">
              {formatPrice(total, locale)}
            </span>
          </div>
        </div>
      </form>
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="cursor-pointer h-10 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
          disabled={isPending || loadingCustomers}
          className="cursor-pointer h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
        >
          {isPending ? t.common.loading : t.order.confirm}
        </button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
