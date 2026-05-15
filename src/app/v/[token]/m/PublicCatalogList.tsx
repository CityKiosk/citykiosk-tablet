"use client";

// ============================================================================
// PublicCatalogList — mobile/phone-friendly public catalog (no auth)
// ============================================================================
// View-only: no cart, no editing. Customer scrolls a vertical product grid,
// filters by category chip, searches by name/SKU. Cards link to the public
// product detail route at /v/[token]/p/[productId].
//
// Locale: hardcoded German (matches PublicFlipbook).
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/i18n";
import { PackageIcon, SearchIcon } from "@/components/icons";
import SessionThemeToggle from "../SessionThemeToggle";
import ViewToggle, { VIEW_PREF_KEY } from "../ViewToggle";

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

type DisplayFields = {
  name: boolean;
  description: boolean;
  sku: boolean;
  dimensions: boolean;
  price: boolean;
  packagingUnit: boolean;
};

const PAGE_BATCH = 24;

export default function PublicCatalogList({
  token,
  products,
  categories,
  displayFields,
}: {
  token: string;
  products: Product[];
  categories: Category[];
  displayFields: DisplayFields;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH);

  // Honor a persisted "flipbook" preference from a prior visit by redirecting
  // back to the flipbook view. The default for first-time mobile visitors is
  // already "list" (we got here via UA-based server redirect), so an empty
  // localStorage stays on this page.
  useEffect(() => {
    try {
      const pref = localStorage.getItem(VIEW_PREF_KEY);
      if (pref === "flipbook") {
        router.replace(`/v/${token}?view=flipbook`);
      }
    } catch {}
  }, [router, token]);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c] as const)),
    [categories],
  );

  const countByCat = useMemo(
    () =>
      products.reduce((m, p) => {
        if (p.category_id) m.set(p.category_id, (m.get(p.category_id) || 0) + 1);
        return m;
      }, new Map<string, number>()),
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });
    const list = products.filter((p) => {
      if (activeCat !== "all" && p.category_id !== activeCat) return false;
      if (!q) return true;
      const name = p.name_de.toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      const cat = p.category_id ? catById.get(p.category_id) : undefined;
      const catName = cat ? cat.name_de.toLowerCase() : "";
      return name.includes(q) || sku.includes(q) || catName.includes(q);
    });
    return [...list].sort((a, b) => collator.compare(a.name_de, b.name_de));
  }, [search, activeCat, products, catById]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < filtered.length;
  const loadMore = useCallback(() => {
    setVisibleCount((c) => c + PAGE_BATCH);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, visibleCount]);

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sticky header — brand strip + theme + view toggle */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="h-12 flex items-center gap-2 px-3">
          <h1 className="flex-1 min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide truncate">
            Souvenirs Berlin — Produktkatalog
          </h1>
          <div className="flex-shrink-0 flex items-center gap-1">
            <ViewToggle current="list" token={token} />
            <SessionThemeToggle />
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon
              width={16}
              height={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <label htmlFor="public-search" className="sr-only">
              Produkte durchsuchen
            </label>
            <input
              id="public-search"
              type="search"
              inputMode="search"
              placeholder="Suchen — Name oder Art.-Nr."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_BATCH);
              }}
              className="w-full h-10 pl-9 pr-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            />
          </div>
        </div>

        {/* Category chips — horizontal scroll */}
        <nav
          aria-label="Kategorie filtern"
          className="overflow-x-auto scrollbar-none border-t border-slate-200 dark:border-slate-800"
        >
          <ul className="flex items-center gap-1.5 px-3 py-2 whitespace-nowrap">
            <li>
              <Chip
                label="Alle"
                active={activeCat === "all"}
                onClick={() => {
                  setActiveCat("all");
                  setVisibleCount(PAGE_BATCH);
                }}
              />
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Chip
                  label={c.name_de}
                  count={countByCat.get(c.id) || 0}
                  active={activeCat === c.id}
                  onClick={() => {
                    setActiveCat(c.id);
                    setVisibleCount(PAGE_BATCH);
                  }}
                />
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Result count */}
      <div className="px-3 pt-3 text-xs text-slate-500 dark:text-slate-400 tabular">
        {filtered.length === 1
          ? "1 Produkt"
          : `${filtered.length} Produkte`}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="px-3 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <PackageIcon width={22} height={22} />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            Keine Produkte gefunden
          </p>
          {(search || activeCat !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setActiveCat("all");
                setVisibleCount(PAGE_BATCH);
              }}
              className="cursor-pointer mt-3 text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      ) : (
        <div className="px-3 pb-12">
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
            {filtered.slice(0, visibleCount).map((p, idx) => (
              <li key={p.id}>
                <ProductCard
                  product={p}
                  token={token}
                  displayFields={displayFields}
                  priority={idx < 4}
                />
              </li>
            ))}
          </ul>
          {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}

function Chip({
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
      className={`cursor-pointer h-8 px-3 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
        active
          ? "bg-sky-700 text-white shadow-sm"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 opacity-70 tabular">({count})</span>
      )}
    </button>
  );
}

function ProductCard({
  product,
  token,
  displayFields,
  priority,
}: {
  product: Product;
  token: string;
  displayFields: DisplayFields;
  priority: boolean;
}) {
  const showSku = displayFields.sku && !!product.sku;
  const showPackaging = displayFields.packagingUnit && !!product.packaging_unit;

  return (
    <Link
      href={`/v/${token}/p/${product.id}`}
      prefetch={false}
      className="group block rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-shadow"
    >
      <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name_de}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 dark:text-slate-600">
            <PackageIcon width={28} height={28} />
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        {displayFields.name && (
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-50 leading-tight line-clamp-2 min-h-[2.25em]">
            {product.name_de}
          </div>
        )}
        <div className="mt-1 flex items-center justify-between gap-2">
          {displayFields.price ? (
            <span className="text-sm font-semibold text-sky-700 dark:text-sky-400 tabular">
              {formatPrice(product.price)}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          {showPackaging && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular">
              VE {product.packaging_unit}
            </span>
          )}
        </div>
        {showSku && (
          <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 tabular line-clamp-1">
            Art.-Nr. {product.sku}
          </div>
        )}
      </div>
    </Link>
  );
}
