"use client";

// ============================================================================
// CatalogClient — Client Component for interactive catalog
// ============================================================================
// Receives server-fetched data, handles search/filter/sort on client.
// No localStorage, no seed data — everything comes from Supabase via props.
// ============================================================================

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useI18n } from "@/components/I18nProvider";
import ProductCard from "@/components/ProductCard";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { SearchIcon, PackageIcon } from "@/components/icons";

type Category = {
  id: string;
  slug: string;
  name_de: string;
  sort_order: number;
};

type Product = {
  id: string;
  name_de: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  dimensions: string | null;
  packaging_unit: number | null;
  sku: string | null;
  description_de: string | null;
  sort_order: number;
};

type Sort = "name" | "price-asc" | "price-desc";

export function CatalogClient({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [visibleCount, setVisibleCount] = useState(18);
  const [gridCols, setGridCols] = useState<2 | 3>(() => {
    if (typeof window === "undefined") return 2;
    return (localStorage.getItem("catalog_cols") === "3" ? 3 : 2);
  });

  function toggleGridCols(cols: 2 | 3) {
    setGridCols(cols);
    localStorage.setItem("catalog_cols", String(cols));
  }

  const loadMore = useCallback(() => {
    setVisibleCount((c) => c + 24);
  }, []);

  // Infinite scroll — load more when sentinel is visible
  const sentinelRef = useRef<HTMLDivElement>(null);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c] as const)),
    [categories],
  );

  const countByCat = useMemo(
    () => products.reduce((m, p) => {
      if (p.category_id) m.set(p.category_id, (m.get(p.category_id) || 0) + 1);
      return m;
    }, new Map<string, number>()),
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = products.filter((p) => {
      if (activeCat !== "all" && p.category_id !== activeCat) return false;
      if (!q) return true;
      const name = p.name_de.toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      const cat = p.category_id ? catById.get(p.category_id) : undefined;
      const catName = cat ? cat.name_de.toLowerCase() : "";
      return name.includes(q) || sku.includes(q) || catName.includes(q);
    });

    if (sort === "name") {
      const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });
      list = [...list].sort((a, b) => collator.compare(a.name_de, b.name_de));
    } else if (sort === "price-asc") {
      list = [...list].sort((a, b) => a.price - b.price);
    } else {
      list = [...list].sort((a, b) => b.price - a.price);
    }
    return list;
  }, [search, activeCat, products, sort, catById]);

  // Infinite scroll observer — re-attach when visibleCount or filtered changes
  const hasMore = visibleCount < filtered.length;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, visibleCount]);

  return (
    <div>
      <PageHeader title={t.catalog.title} subtitle={t.catalog.subtitle} />

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon
              width={18}
              height={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <label htmlFor="product-search" className="sr-only">
              {t.catalog.searchLabel}
            </label>
            <input
              id="product-search"
              type="search"
              placeholder={t.catalog.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-3 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" role="group" aria-label="Spalten">
              {([2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleGridCols(n)}
                  aria-pressed={gridCols === n}
                  className={`cursor-pointer w-10 h-11 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                    gridCols === n
                      ? "bg-sky-700 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <label htmlFor="sort" className="sr-only">
              {t.catalog.sortLabel}
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="cursor-pointer h-11 px-3 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            >
              <option value="name">{t.catalog.sortName}</option>
              <option value="price-asc">{t.catalog.sortPriceAsc}</option>
              <option value="price-desc">{t.catalog.sortPriceDesc}</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.catalog.categoryFilter}>
          <CatChip
            label={t.catalog.all}
            active={activeCat === "all"}
            onClick={() => { setActiveCat("all"); setVisibleCount(24); }}
          />
          {categories.map((c) => (
            <CatChip
              key={c.id}
              label={c.name_de}
              active={activeCat === c.id}
              onClick={() => { setActiveCat(c.id); setVisibleCount(24); }}
              count={countByCat.get(c.id) || 0}
            />
          ))}
        </div>
      </div>

      {/* Product count */}
      {products.length === 0 ? (
        <EmptyState
          icon={<PackageIcon width={24} height={24} />}
          title="Noch keine Produkte"
          actionLabel="Produkte werden bald hinzugefügt"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PackageIcon width={24} height={24} />}
          title={t.catalog.empty}
          actionLabel={t.catalog.clearFilters}
          onAction={() => {
            setSearch("");
            setActiveCat("all");
          }}
        />
      ) : (
        <>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            {t.catalog.resultCount(filtered.length)}
          </div>
          <div className={`grid gap-4 ${gridCols === 3 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
            {filtered.slice(0, visibleCount).map((p, idx) => {
              const cat = p.category_id ? catById.get(p.category_id) : undefined;
              return (
                <ProductCard
                  key={p.id}
                  priority={idx < 4}
                  gridCols={gridCols}
                  product={{
                    id: p.id,
                    image: p.image_url || "",
                    categoryId: p.category_id || "",
                    price: p.price,
                    sku: p.sku || undefined,
                    dim: p.dimensions || undefined,
                    description: p.description_de || undefined,
                    customName: p.name_de,
                  }}
                  category={cat ? { id: cat.id, nameDe: cat.name_de } : undefined}
                  isCustom={false}
                />
              );
            })}
          </div>
          {/* Prefetch next 2 batches of images */}
          {filtered.slice(visibleCount, visibleCount + 48).map((p) =>
            p.image_url ? (
              <link key={p.id} rel="prefetch" href={p.image_url} as="image" />
            ) : null
          )}
          {/* Infinite scroll sentinel */}
          {visibleCount < filtered.length && (
            <div ref={sentinelRef} className="h-1" />
          )}
        </>
      )}
    </div>
  );
}

function CatChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer flex-shrink-0 whitespace-nowrap h-9 px-3.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
        active
          ? "bg-sky-700 text-white shadow-sm"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1.5 opacity-70">({count})</span>
      )}
    </button>
  );
}
