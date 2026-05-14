"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import { StockRow } from "@/components/StockRow";
import StockDetailDialog from "@/components/StockDetailDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SearchIcon } from "@/components/icons";
import PinGate from "@/components/PinGate";
import IdleLock, { ADMIN_IDLE_LOCK_MS } from "@/components/IdleLock";
import { updateStock } from "./actions";
import { lockPin } from "@/app/(dashboard)/settings/actions";
import type { StockCategory, StockProduct } from "./types";

type Props = {
  products: StockProduct[];
  categories: StockCategory[];
};

type SortKey = "low-first" | "az";

// Per-page unlock key. Each admin page (settings / stock / orders /
// customers) has its own key so unlocking one does NOT open the others —
// prevents the "owner hands tablet over after using one admin page, and
// the customer navigates to a different admin page that's still open"
// class of leak.
const UNLOCK_KEY = "souvenir_admin_unlocked_stock";

export function StockClient({ products: initialProducts, categories }: Props) {
  const { t, locale } = useI18n();
  const toast = useToast();

  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    // Server state is the source of truth — sessionStorage is intentionally
    // not consulted on mount (a stale client flag could bypass the pinpad
    // after a server-side reset).
    return () => {
      try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
      // Lock the page the moment the owner navigates away.
      // A shared tablet must not stay unlocked behind the owner's back.
      void lockPin("stock");
    };
  }, []);

  // Local product state — lets us reflect saved stock values without a full
  // page reload. Server-side revalidatePath still refreshes it on navigation.
  const [products, setProducts] = useState<StockProduct[]>(initialProducts);
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("low-first");
  const [detail, setDetail] = useState<StockProduct | null>(null);
  const [pendingNavigate, setPendingNavigate] = useState<StockProduct | null>(null);

  const getName = useCallback((item: { name_de: string }) => item.name_de, []);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c] as const)),
    [categories],
  );

  const filtered = useMemo(() => {
    let list = products;
    if (catFilter !== "all") {
      list = list.filter((p) => p.category_id === catFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name_de.toLowerCase().includes(q) ||
          (p.sku?.toLowerCase().includes(q) ?? false),
      );
    }
    const sorted = [...list];
    if (sort === "low-first") {
      sorted.sort((a, b) => a.stock - b.stock || a.name_de.localeCompare(b.name_de, "de"));
    } else {
      sorted.sort((a, b) => a.name_de.localeCompare(b.name_de, "de"));
    }
    return sorted;
  }, [products, catFilter, search, sort, getName, locale]);

  const handlePersist = useCallback(
    async (productId: string, nextStock: number, previousStock: number): Promise<number | null> => {
      const result = await updateStock(productId, nextStock);
      if (result.error || result.stock === undefined) {
        toast.show(t.stock.saveFailed, "error");
        return null;
      }
      // Reflect persisted value locally. The server action already calls
      // revalidatePath, and staleTimes.dynamic=0 in next.config keeps the
      // Router Cache fresh — no explicit router.refresh() needed (it would
      // race the action's own revalidation and flicker stale values in).
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: result.stock! } : p)),
      );
      // Undo toast — reverts to previous stock on click.
      toast.showWithAction(t.stock.saved, {
        label: t.stock.undo,
        onClick: async () => {
          const undo = await updateStock(productId, previousStock);
          if (undo.error || undo.stock === undefined) {
            toast.show(t.stock.saveFailed, "error");
            return;
          }
          setProducts((prev) =>
            prev.map((p) => (p.id === productId ? { ...p, stock: undo.stock! } : p)),
          );
          toast.show(t.stock.undone);
        },
      });
      return result.stock;
    },
    [t.stock.saved, t.stock.saveFailed, t.stock.undo, t.stock.undone, toast],
  );

  if (!unlocked) {
    return (
      <div>
        <PageHeader title={t.stock.title} subtitle={t.stock.subtitle} />
        <PinGate
          unlockTitle={t.pin.unlockTitleStock}
          sessionKey={UNLOCK_KEY}
          scope="stock"
          // Show "Admin-PIN funktioniert hier auch" only when the Lager-PIN
          // hasn't been set yet. Once it's set, the admin PIN no longer
          // unlocks /stock (strict scope) — surfacing the hint at that
          // point would be a misleading nudge.
          fallbackHintScope="stock"
          fallbackHint={t.pin.fallbackHintStock}
          onUnlocked={() => setUnlocked(true)}
        />
      </div>
    );
  }

  return (
    <div>
      <IdleLock
        timeoutMs={ADMIN_IDLE_LOCK_MS}
        onExpire={() => {
          try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
          void lockPin("stock");
          setUnlocked(false);
        }}
      />
      <PageHeader title={t.stock.title} subtitle={t.stock.subtitle} />

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <SearchIcon
                width={18}
                height={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="search"
                placeholder={t.stock.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              />
            </div>
            <div
              className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg flex-shrink-0"
              role="group"
              aria-label={t.stock.sortLowFirst}
            >
              <button
                type="button"
                onClick={() => setSort("low-first")}
                aria-pressed={sort === "low-first"}
                className={`cursor-pointer h-8 px-3 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                  sort === "low-first"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {t.stock.sortLowFirst}
              </button>
              <button
                type="button"
                onClick={() => setSort("az")}
                aria-pressed={sort === "az"}
                className={`cursor-pointer h-8 px-3 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                  sort === "az"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {t.stock.sortAZ}
              </button>
            </div>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCatFilter("all")}
              className={`cursor-pointer h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                catFilter === "all"
                  ? "bg-sky-700 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {t.stock.allCategories} ({products.length})
            </button>
            {categories.map((c) => {
              const count = products.filter((p) => p.category_id === c.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatFilter(c.id)}
                  className={`cursor-pointer h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    catFilter === c.id
                      ? "bg-sky-700 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {getName(c)} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          {t.stock.productCount(filtered.length)}
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.stock.noProducts}
          </p>
        ) : (
          <ul>
            {filtered.map((p) => {
              const cat = p.category_id ? categoryMap.get(p.category_id) : undefined;
              return (
                <StockRow
                  key={p.id}
                  product={p}
                  categoryName={cat ? getName(cat) : null}
                  onPersist={handlePersist}
                  onOpenDetail={setDetail}
                />
              );
            })}
          </ul>
        )}
      </div>

      {detail && (() => {
        const idx = filtered.findIndex((p) => p.id === detail.id);
        // If the detail product isn't in the current filter, fall back to the
        // unfiltered list so prev/next still work sensibly.
        const list = idx === -1 ? products : filtered;
        const listIdx = list.findIndex((p) => p.id === detail.id);
        const prev = listIdx > 0 ? list[listIdx - 1] : null;
        const next = listIdx !== -1 && listIdx < list.length - 1 ? list[listIdx + 1] : null;
        const position = {
          current: listIdx === -1 ? 1 : listIdx + 1,
          total: list.length,
        };
        const cat = detail.category_id ? categoryMap.get(detail.category_id) : undefined;
        // Always read the freshest copy from products (stock may have changed
        // since the dialog was opened — e.g. order trigger fired).
        const fresh = products.find((p) => p.id === detail.id) ?? detail;
        return (
          <StockDetailDialog
            key={detail.id}
            product={fresh}
            categoryName={cat ? getName(cat) : null}
            prev={prev}
            next={next}
            position={position}
            onClose={() => setDetail(null)}
            onNavigate={(target, dirty) => {
              if (dirty) {
                setPendingNavigate(target);
              } else {
                setDetail(target);
              }
            }}
            onSave={handlePersist}
          />
        );
      })()}

      {pendingNavigate && (
        <ConfirmDialog
          open={true}
          message={t.add2.discardChanges}
          onConfirm={() => {
            setDetail(pendingNavigate);
            setPendingNavigate(null);
          }}
          onCancel={() => setPendingNavigate(null)}
        />
      )}
    </div>
  );
}
