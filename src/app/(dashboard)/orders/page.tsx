"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { formatDateTime, formatPrice } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/components/I18nProvider";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ReceiptIcon, SearchIcon, ChevronRightIcon, Trash2Icon } from "@/components/icons";
import { fetchOrders, deleteOrder, type OrderRow } from "./actions";

export default function OrdersPage() {
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState<OrderRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    fetchOrders().then((res) => {
      if (res.data) setOrders(res.data);
      setLoaded(true);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.customer_shop_name.toLowerCase().includes(q) ||
        o.customer_first_name.toLowerCase().includes(q) ||
        (o.customer_last_name?.toLowerCase().includes(q) ?? false) ||
        o.order_number.toLowerCase().includes(q)
    );
  }, [orders, search]);

  function handleDelete(o: OrderRow) {
    startTransition(async () => {
      const result = await deleteOrder(o.id);
      if (result.error) {
        toast.show(result.error);
        return;
      }
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
      setConfirmDel(null);
      toast.show(t.orders.deleted);
    });
  }

  const customerDisplay = (o: OrderRow) =>
    o.customer_first_name + (o.customer_last_name ? ` ${o.customer_last_name}` : "");

  if (!loaded) {
    return (
      <div>
        <PageHeader title={t.orders.listTitle} />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div>
        <PageHeader title={t.orders.listTitle} />
        <EmptyState
          icon={<ReceiptIcon width={24} height={24} />}
          title={t.orders.empty}
          description={t.orders.emptyHint}
          actionLabel={t.orders.goCatalog}
          actionHref="/catalog"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`${t.orders.listTitle} (${orders.length})`} />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <SearchIcon
              width={18}
              height={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <label htmlFor="orders-search" className="sr-only">
              {t.orders.searchLabel}
            </label>
            <input
              id="orders-search"
              type="search"
              placeholder={t.orders.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.orders.noMatch}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3">{t.orders.columns.shop}</th>
                  <th className="px-5 py-3">{t.orders.columns.customer}</th>
                  <th className="px-5 py-3 text-right">{t.orders.columns.items}</th>
                  <th className="px-5 py-3 text-right">{t.orders.columns.total}</th>
                  <th className="px-5 py-3">{t.orders.columns.date}</th>
                  <th className="px-5 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => (window.location.href = `/orders/${o.id}`)}
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-50">
                      {o.customer_shop_name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{customerDisplay(o)}</td>
                    <td className="tabular px-5 py-3.5 text-right text-slate-700 dark:text-slate-300">
                      {o.items.length}
                    </td>
                    <td className="tabular px-5 py-3.5 text-right font-semibold text-slate-900 dark:text-slate-50">
                      {formatPrice(o.gross_total)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(o.created_at, locale)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDel(o);
                          }}
                          aria-label={t.orders.delete}
                          className="cursor-pointer w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 transition-colors disabled:opacity-60"
                        >
                          <Trash2Icon width={15} height={15} />
                        </button>
                        <ChevronRightIcon className="text-slate-400 group-hover:text-sky-500" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="cursor-pointer flex items-center gap-3 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors focus-visible:outline-none focus-visible:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900 dark:text-slate-50 truncate">
                        {o.customer_shop_name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {customerDisplay(o)} · {t.orders.itemsCount(o.items.length)}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        {formatDateTime(o.created_at, locale)}
                      </div>
                    </div>
                    <div className="tabular text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {formatPrice(o.gross_total)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        message={confirmDel ? t.orders.deleteConfirm(confirmDel.customer_shop_name) : ""}
        onConfirm={() => confirmDel && handleDelete(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
