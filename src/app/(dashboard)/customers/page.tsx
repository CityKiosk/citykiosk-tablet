"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, formatPrice } from "@/lib/i18n";
import { useI18n } from "@/components/I18nProvider";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { UsersIcon, SearchIcon } from "@/components/icons";
import { fetchCustomerStats, type CustomerStatRow } from "@/app/(dashboard)/orders/actions";

export default function CustomersPage() {
  const { t, locale } = useI18n();
  const [customers, setCustomers] = useState<CustomerStatRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCustomerStats().then((res) => {
      if (res.data) setCustomers(res.data);
      setLoaded(true);
    });
  }, []);

  const filtered = useMemo(() => {
    const list = [...customers].sort((a, b) => a.shop_name.localeCompare(b.shop_name, locale));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.shop_name.toLowerCase().includes(q) ||
        c.first_name.toLowerCase().includes(q) ||
        (c.last_name?.toLowerCase().includes(q) ?? false)
    );
  }, [customers, locale, search]);

  const customerName = (c: CustomerStatRow) =>
    c.first_name + (c.last_name ? ` ${c.last_name}` : "");

  if (!loaded) {
    return <div className="h-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />;
  }

  if (customers.length === 0) {
    return (
      <div>
        <PageHeader title={t.customers.title} subtitle={t.customers.subtitle} />
        <EmptyState
          icon={<UsersIcon width={24} height={24} />}
          title={t.customers.empty}
          description={t.customers.emptyHint}
          actionLabel={t.orders.goCatalog}
          actionHref="/catalog"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t.customers.title} subtitle={t.customers.subtitle} />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <SearchIcon
              width={18}
              height={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              placeholder={t.orders.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-5 py-3">{t.customers.columns.shop}</th>
              <th className="px-5 py-3">{t.customers.columns.name}</th>
              <th className="px-5 py-3 text-right">{t.customers.columns.orders}</th>
              <th className="px-5 py-3 text-right hidden md:table-cell">{t.customers.columns.lastOrder}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((c) => (
              <tr key={c.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-50 max-w-[200px] truncate">{c.shop_name}</td>
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{customerName(c)}</td>
                <td className="tabular px-5 py-3.5 text-right">
                  {c.order_count > 0 ? (
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-50">{c.order_count}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatPrice(c.total_spent, locale)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">
                  {c.last_order_at ? formatDate(c.last_order_at, locale) : t.customers.never}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/catalog" className="cursor-pointer text-sky-700 dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded">
          {t.customers.new} →
        </Link>
      </p>
    </div>
  );
}
