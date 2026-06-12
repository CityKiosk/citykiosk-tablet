"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { formatDateTime, formatPrice } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/components/I18nProvider";
import EmptyState from "@/components/EmptyState";
import LoadError from "@/components/LoadError";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  ReceiptIcon,
  SearchIcon,
  ChevronRightIcon,
  Trash2Icon,
  XIcon,
  CalendarIcon,
} from "@/components/icons";
import { fetchOrders, deleteOrder, type OrderRow } from "./actions";
import DatePicker from "@/components/DatePicker";
import {
  presetRange,
  isPresetActive,
  type Preset,
  type DateRangeIso,
} from "@/lib/dateRange";

type Filters = {
  search: string;
  dateFrom: string;
  dateTo: string;
  customerId: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  customerId: "",
};

function rangeFromFilters(f: Filters): DateRangeIso {
  return { from: f.dateFrom, to: f.dateTo };
}

export default function OrdersPage() {
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [confirmDel, setConfirmDel] = useState<OrderRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function load() {
    setLoaded(false);
    setLoadFailed(false);
    fetchOrders().then((res) => {
      // Hata ile boş listeyi ayır — yükleme hatası "sipariş yok" gibi
      // görünmemeli (cold start'ta yanıltıcı).
      if (res.data) setOrders(res.data);
      else setLoadFailed(true);
      setLoaded(true);
    });
  }

  useEffect(() => {
    load();
  }, []);

  // Defer the freetext search so typing doesn't block the table re-render on
  // 1000-row lists. Date / customer changes are single-tap and don't need it.
  const deferredSearch = useDeferredValue(filters.search);

  // Customer options derived from orders — only customers that actually have
  // orders are filterable. Sorted by shop name (German collation).
  const customerOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    for (const o of orders) {
      if (!o.customer_id || seen.has(o.customer_id)) continue;
      const personName = [o.customer_first_name, o.customer_last_name]
        .filter(Boolean)
        .join(" ");
      const label = personName
        ? `${o.customer_shop_name} — ${personName}`
        : o.customer_shop_name;
      seen.set(o.customer_id, { id: o.customer_id, label });
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [orders]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (q) {
        const hit =
          o.customer_shop_name.toLowerCase().includes(q) ||
          o.customer_first_name.toLowerCase().includes(q) ||
          (o.customer_last_name?.toLowerCase().includes(q) ?? false) ||
          o.order_number.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filters.customerId && o.customer_id !== filters.customerId) return false;
      if (filters.dateFrom || filters.dateTo) {
        const day = o.created_at.slice(0, 10);
        if (filters.dateFrom && day < filters.dateFrom) return false;
        if (filters.dateTo && day > filters.dateTo) return false;
      }
      return true;
    });
  }, [orders, deferredSearch, filters.customerId, filters.dateFrom, filters.dateTo]);

  const activeFilterCount =
    (filters.dateFrom || filters.dateTo ? 1 : 0) + (filters.customerId ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  // Summed once per filtered set so the metrics row reflects the same scope
  // shown in the table below.
  const filteredTotal = useMemo(
    () => filtered.reduce((sum, o) => sum + (o.gross_total ?? 0), 0),
    [filtered],
  );
  const grandTotal = useMemo(
    () => orders.reduce((sum, o) => sum + (o.gross_total ?? 0), 0),
    [orders],
  );
  const showsSubset = hasActiveFilters || deferredSearch.trim().length > 0;

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function applyPreset(preset: Preset) {
    const range = presetRange(preset);
    setFilters((prev) => ({ ...prev, dateFrom: range.from, dateTo: range.to }));
  }

  function clearDateRange() {
    setFilters((prev) => ({ ...prev, dateFrom: "", dateTo: "" }));
  }

  function clearCustomer() {
    setFilters((prev) => ({ ...prev, customerId: "" }));
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
  }

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

  const selectedCustomerLabel = filters.customerId
    ? customerOptions.find((c) => c.id === filters.customerId)?.label
    : null;

  // Friendly label for the active date-range chip — locale-aware short format.
  function formatDateChip(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y.slice(2)}`;
  }
  const dateChipLabel =
    filters.dateFrom && filters.dateTo
      ? filters.dateFrom === filters.dateTo
        ? formatDateChip(filters.dateFrom)
        : `${formatDateChip(filters.dateFrom)} – ${formatDateChip(filters.dateTo)}`
      : filters.dateFrom
      ? `≥ ${formatDateChip(filters.dateFrom)}`
      : filters.dateTo
      ? `≤ ${formatDateChip(filters.dateTo)}`
      : null;

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

  if (loadFailed) {
    return (
      <div>
        <PageHeader title={t.orders.listTitle} />
        <LoadError onRetry={load} />
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

  const presets: Preset[] = ["today", "thisWeek", "thisMonth", "lastMonth"];
  const inputCls =
    "w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60";

  return (
    <div>
      <PageHeader title={t.orders.listTitle} />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-3">
          {/* Row 1: search */}
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
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
              className="w-full h-10 pl-10 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            />
          </div>

          {/* Row 2: two single-date pickers (Von / Bis) + customer.
              Two pickers instead of a range picker so non-technical users
              can pick each date independently — same mental model as native
              date inputs but with a styled calendar. */}
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {t.orders.filters.dateFrom}
                </span>
                <DatePicker
                  value={filters.dateFrom}
                  onChange={(next) => update("dateFrom", next)}
                  max={filters.dateTo}
                  placeholder={t.orders.filters.dateFrom}
                  todayLabel={t.orders.filters.pickerToday}
                  clearLabel={t.orders.filters.pickerClear}
                  ariaLabel={t.orders.filters.dateFrom}
                />
              </div>
              <div>
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {t.orders.filters.dateTo}
                </span>
                <DatePicker
                  value={filters.dateTo}
                  onChange={(next) => update("dateTo", next)}
                  min={filters.dateFrom}
                  placeholder={t.orders.filters.dateTo}
                  todayLabel={t.orders.filters.pickerToday}
                  clearLabel={t.orders.filters.pickerClear}
                  ariaLabel={t.orders.filters.dateTo}
                />
              </div>
            </div>
            <label className="block flex-1 md:max-w-xs">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                {t.orders.filters.customerLabel}
              </span>
              <select
                value={filters.customerId}
                onChange={(e) => update("customerId", e.target.value)}
                className={inputCls}
              >
                <option value="">{t.orders.filters.customerAll}</option>
                {customerOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Preset chips */}
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const active = isPresetActive(p, rangeFromFilters(filters));
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  aria-pressed={active}
                  className={`cursor-pointer h-9 px-3.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                    active
                      ? "bg-sky-700 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {t.orders.filters[p]}
                </button>
              );
            })}
          </div>

          {/* Active filter chips + reset */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {dateChipLabel && (
                <span className="inline-flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 text-xs font-medium">
                  <CalendarIcon width={13} height={13} className="opacity-70" />
                  {dateChipLabel}
                  <button
                    type="button"
                    onClick={clearDateRange}
                    aria-label={t.orders.filters.removeDateRange}
                    className="cursor-pointer ml-1 w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-sky-100 dark:hover:bg-sky-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                  >
                    <XIcon width={13} height={13} />
                  </button>
                </span>
              )}
              {selectedCustomerLabel && (
                <span className="inline-flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 text-xs font-medium max-w-xs">
                  <span className="truncate">{selectedCustomerLabel}</span>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    aria-label={t.orders.filters.removeCustomer}
                    className="cursor-pointer ml-1 w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-sky-100 dark:hover:bg-sky-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 flex-shrink-0"
                  >
                    <XIcon width={13} height={13} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="cursor-pointer ml-auto text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded px-1"
              >
                {t.orders.filters.resetAll}
              </button>
            </div>
          )}
        </div>

        {/* Summary row — count + grand total. aria-live so the screen reader
            announces the new totals after a filter change. */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs"
          aria-live="polite"
        >
          <div className="text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-50">
              {t.orders.filters.summaryCount(filtered.length)}
            </span>
            {showsSubset && (
              <span className="ml-1 text-slate-500 dark:text-slate-500">
                ({t.orders.filters.summarySubset(filtered.length, orders.length)})
              </span>
            )}
          </div>
          <div className="text-slate-600 dark:text-slate-400">
            {t.orders.filters.summaryTotal}{" "}
            <span className="tabular font-semibold text-slate-900 dark:text-slate-50">
              {formatPrice(filteredTotal)}
            </span>
            {showsSubset && filteredTotal !== grandTotal && (
              <span className="ml-1 tabular text-slate-500 dark:text-slate-500">
                / {formatPrice(grandTotal)}
              </span>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>{hasActiveFilters ? t.orders.filters.noMatchFiltered : t.orders.noMatch}</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="cursor-pointer mt-3 inline-flex items-center h-10 px-4 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              >
                {t.orders.filters.resetAll}
              </button>
            )}
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
