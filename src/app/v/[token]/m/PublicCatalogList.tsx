"use client";

// ============================================================================
// PublicCatalogList — mobile/phone-friendly public catalog (no auth)
// ============================================================================
// View-only: no cart, no editing. Customer scrolls a vertical product grid,
// filters by category chip, searches by name/SKU. Cards link to the public
// product detail route at /v/[token]/p/[productId].
//
// State (search / activeCat / visibleCount / scroll position) is persisted
// to sessionStorage by useCatalogListState + useScrollRestoration so back-
// navigation from a product detail feels like the list stayed where it was.
//
// Locale: hardcoded German (matches PublicFlipbook).
// ============================================================================

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/i18n";
import { PackageIcon, SearchIcon } from "@/components/icons";
import PublicLegalFooter from "../_components/PublicLegalFooter";
import SessionThemeToggle from "../_components/SessionThemeToggle";
import ViewToggle, { VIEW_PREF_KEY } from "../_components/ViewToggle";
import { useCatalogListState } from "../_hooks/useCatalogListState";
import { useScrollRestoration } from "../_hooks/useScrollRestoration";
import type {
  PublicProduct,
  PublicCategory,
  PublicDisplayFields,
} from "../_data/catalog";

type Props = {
  token: string;
  products: PublicProduct[];
  categories: PublicCategory[];
  displayFields: PublicDisplayFields;
};

export default function PublicCatalogList({
  token,
  products,
  categories,
  displayFields,
}: Props) {
  const router = useRouter();
  const {
    search,
    activeCat,
    visibleCount,
    setSearch,
    setActiveCat,
    reset,
    loadMore,
  } = useCatalogListState(token);

  // Honor a persisted "flipbook" preference from a prior visit. Middleware
  // already routed phones here; this hop only fires when the customer
  // explicitly chose the flipbook on a previous visit from the same device.
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_PREF_KEY) === "flipbook") {
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

  const hasMore = visibleCount < filtered.length;
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  // Keep the active category chip centered in the horizontal scroller so a
  // customer returning from session-restored state (or tapping a chip that
  // happens to be off-screen) doesn't lose track of where they are.
  const chipNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = chipNavRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    if (!el) return;
    el.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [activeCat]);

  // Restore scroll only after the visible slice is rendered (otherwise the
  // saved Y would be clipped because the document hasn't grown yet).
  useScrollRestoration(token, filtered.length > 0);

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* pt-safe: çentikli telefonlarda başlık status bar altına girmesin */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur border-b border-slate-200 dark:border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="h-12 flex items-center gap-2 px-3">
          <h1 className="flex-1 min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide truncate">
            Souvenirs Berlin — Produktkatalog
          </h1>
          <div className="flex-shrink-0 flex items-center gap-1">
            <ViewToggle current="list" token={token} />
            <SessionThemeToggle />
          </div>
        </div>

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
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            />
          </div>
        </div>

        <nav
          ref={chipNavRef}
          aria-label="Kategorie filtern"
          className="overflow-x-auto scrollbar-none border-t border-slate-200 dark:border-slate-800 [mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)]"
        >
          <ul className="flex items-center gap-1.5 px-3 py-2 whitespace-nowrap">
            <li>
              <Chip
                label="Alle"
                active={activeCat === "all"}
                onClick={() => setActiveCat("all")}
              />
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Chip
                  label={c.name_de}
                  count={countByCat.get(c.id) || 0}
                  active={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                />
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="px-3 pt-3 text-xs text-slate-500 dark:text-slate-400 tabular">
        {filtered.length === 1 ? "1 Produkt" : `${filtered.length} Produkte`}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          showReset={search.length > 0 || activeCat !== "all"}
          onReset={reset}
        />
      ) : (
        <div className="px-3">
          {/* 375px'te 2 kolon: kartlar kompakt, tek kolonda 50 ürün = çok uzun scroll */}
          <ul className="grid grid-cols-2 gap-3 mt-2">
            {filtered.slice(0, visibleCount).map((p, idx) => (
              <li key={p.id}>
                <ProductCard
                  product={p}
                  token={token}
                  displayFields={displayFields}
                  priority={idx < 2}
                />
              </li>
            ))}
          </ul>
          {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
        </div>
      )}

      <PublicLegalFooter token={token} />
    </div>
  );
}

// ── Subcomponents (local — only used by this view) ─────────────────────────

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
      data-active={active}
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
  product: PublicProduct;
  token: string;
  displayFields: PublicDisplayFields;
  priority: boolean;
}) {
  // Every conditional below collapses fully when the toggle is off OR the
  // product has no value for that field — no placeholder rows, no min-h
  // reservations. Card height adapts to the data shown.
  const showSku = displayFields.sku && !!product.sku;
  const showPackaging = displayFields.packagingUnit && !!product.packaging_unit;
  const showDimensions = displayFields.dimensions && !!product.dimensions;
  const showDescription = displayFields.description && !!product.description_de;

  return (
    <Link
      href={`/v/${token}/p/${product.id}`}
      className="group block rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-shadow"
    >
      <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name_de}
            fill
            sizes="50vw"
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
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-50 leading-tight line-clamp-2">
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
        {showDimensions && (
          <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 tabular line-clamp-1">
            {product.dimensions}
          </div>
        )}
        {showSku && (
          <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 tabular line-clamp-1">
            Art.-Nr. {product.sku}
          </div>
        )}
        {showDescription && (
          <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-3">
            {product.description_de}
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ showReset, onReset }: { showReset: boolean; onReset: () => void }) {
  return (
    <div className="px-3 py-16 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
        <PackageIcon width={22} height={22} />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
        Keine Produkte gefunden
      </p>
      {showReset && (
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer mt-3 text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
        >
          Filter zurücksetzen
        </button>
      )}
    </div>
  );
}

