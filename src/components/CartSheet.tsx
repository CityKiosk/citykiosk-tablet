"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cartStore";
import { useI18n } from "./I18nProvider";
import { formatPrice } from "@/lib/i18n";
import QtyControl from "./QtyControl";
import { XIcon } from "./icons";
import OrderDialog from "./OrderDialog";
import {
  fetchCartProducts,
  type CartProduct,
} from "@/app/(dashboard)/catalog/actions";
import { lockBodyScroll } from "@/lib/scrollLock";

export default function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { quantities, setQty, clear, totalCount, kindCount } = useCart();
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [orderOpen, setOrderOpen] = useState(false);

  const [allProducts, setAllProducts] = useState<CartProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset loaded on each open so the sheet shows a skeleton while fresh
    // data is being fetched (prevents the "empty cart" flash when the sheet
    // opens before fetchCartProducts resolves).
    setLoaded(false);
    fetchCartProducts().then((res) => {
      if (res.products) setAllProducts(res.products);
      setLoaded(true);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const releaseLock = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseLock();
    };
  }, [open, onClose]);

  const items = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([pid, q]) => {
        const p = allProducts.find((x) => x.id === pid);
        if (!p) return null;
        return {
          productId: p.id,
          productName: p.name_de,
          productNameDe: p.name_de,
          productImage: p.image_url || "",
          productSku: p.sku || undefined,
          productDescription: p.description_de ?? undefined,
          quantity: q,
          price: p.price,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [quantities, allProducts]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function onTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientY);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStart === null) return;
    const delta = e.touches[0].clientY - touchStart;
    if (delta > 0) setDragY(delta);
  }
  function onTouchEnd() {
    if (dragY > 80) onClose();
    setTouchStart(null);
    setDragY(0);
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          aria-hidden="true"
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        />
        <div
          ref={sheetRef}
          tabIndex={-1}
          className="relative w-full max-w-3xl md:max-w-4xl bg-white dark:bg-slate-900 rounded-t-3xl shadow-[0_-12px_40px_rgba(15,23,42,0.25)] flex flex-col h-[88dvh] animate-in slide-in-from-bottom duration-300 focus:outline-none border-t border-x border-slate-200 dark:border-slate-800"
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            transform: dragY ? `translateY(${dragY}px)` : undefined,
            transition: dragY ? "none" : "transform 200ms",
          }}
        >
          <div
            className="pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
          </div>
          <div className="px-6 pt-2 pb-4 flex items-start justify-between border-b border-slate-200 dark:border-slate-800 gap-4">
            <div>
              <h2 id={titleId} className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {t.catalog.cartTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.catalog.cartCount(totalCount, kindCount)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.catalog.cartClose}
              className="cursor-pointer w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
            >
              <XIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!loaded && kindCount > 0 ? (
              // Cart has items per localStorage but product details are still
              // being fetched — show a skeleton sized to kindCount so the sheet
              // doesn't flash the "empty" state on open.
              <ul className="space-y-3" aria-label={t.common.loading}>
                {Array.from({ length: Math.min(kindCount, 5) }).map((_, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="h-2.5 w-1/2 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    </div>
                    <div className="w-24 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.catalog.cartEmpty}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-medium text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                >
                  ← Zum Katalog
                </button>
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((i) => (
                  <li
                    key={i.productId}
                    className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={i.productImage}
                      alt=""
                      width={72}
                      height={72}
                      loading="lazy"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover bg-white dark:bg-slate-900 flex-shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900 dark:text-slate-50 truncate">
                        {i.productName}
                      </div>
                      {i.productDescription && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{i.productDescription}</div>
                      )}
                      {i.productSku && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">Art.-Nr. {i.productSku}</div>
                      )}
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular">
                        {formatPrice(i.price)} × {i.quantity}
                      </div>
                      <div className="tabular text-sm font-semibold text-sky-700 dark:text-sky-400 mt-1">
                        {formatPrice(i.price * i.quantity)}
                      </div>
                    </div>
                    <QtyControl
                      value={i.quantity}
                      onChange={(v) => setQty(i.productId, v)}
                      label={i.productName}
                      size="md"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">
                    {t.catalog.cartTotal}
                  </div>
                  <div className="tabular text-xl font-semibold text-slate-900 dark:text-slate-50">
                    {formatPrice(total)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOrderOpen(true)}
                  className="cursor-pointer h-12 px-6 bg-sky-700 hover:bg-sky-800 text-white rounded-xl font-semibold text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
                >
                  {t.catalog.createOrder}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {orderOpen && (
        <OrderDialog
          items={items}
          total={total}
          onClose={() => setOrderOpen(false)}
          onSaved={() => {
            clear();
            setOrderOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
