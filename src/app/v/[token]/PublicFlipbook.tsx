"use client";

// ============================================================================
// PublicFlipbook — Public-facing catalog flipbook (no auth, no dashboard)
// ============================================================================
// Self-contained: no useI18n, no useDisplayFields, no useCart.
// All text hardcoded German (locale always "de").
// Reuses Flipbook + FlipPage from shared components.
// ============================================================================

import { useEffect, useMemo, useRef, useState, memo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { FlipPage } from "@/components/Flipbook";
import { formatPrice } from "@/lib/i18n";
import { ChevronRightIcon, SunIcon, MoonIcon } from "@/components/icons";

const Flipbook = dynamic(() => import("@/components/Flipbook"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
  ),
});

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

// Per-session dark/light toggle. Does NOT persist — overrides only for this tab.
// Customers who haven't toggled keep their OS preference (theme-init.js handles initial).
function SessionThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (!mounted) return null;

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setIsDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Helles Design" : "Dunkles Design"}
      className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
    >
      {isDark ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
    </button>
  );
}

const PAGE_SIZE = 4;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ── Card ──
function CardImpl({ product, displayFields }: { product: Product; displayFields: DisplayFields }) {
  const name = product.name_de;
  const description = product.description_de;
  const showSku = displayFields.sku && !!product.sku;
  const showDimensions = displayFields.dimensions && !!product.dimensions;
  const showPackaging = displayFields.packagingUnit && !!product.packaging_unit;
  const showDescription = displayFields.description && !!description;
  const showMeta = showDimensions || showPackaging;

  return (
    <article className="h-full flex flex-col rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-card p-2">
      <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {product.image_url && (
          <img
            src={product.image_url}
            alt={name}
            loading="eager"
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>
      <div className="flex-shrink-0 px-2 py-1 text-center">
        {displayFields.name && (
          <h3 className="font-semibold text-xs text-slate-900 dark:text-slate-50 leading-tight line-clamp-1 tabular">
            {name}
          </h3>
        )}
        {showSku && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular">Art.-Nr. {product.sku}</div>
        )}
        {showMeta && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex justify-center gap-2 tabular">
            {showDimensions && <span>{product.dimensions}</span>}
            {showPackaging && <span>VE {product.packaging_unit}</span>}
          </div>
        )}
        {showDescription && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{description}</div>
        )}
        {displayFields.price && (
          <span className="tabular text-sm font-semibold text-slate-900 dark:text-slate-50 block mt-0.5">
            {formatPrice(product.price)}
          </span>
        )}
      </div>
    </article>
  );
}

const Card = memo(CardImpl);

// ── Category Cover ──
function CoverPage({ category, sample }: { category: Category; sample: Product[] }) {
  const name = category.name_de;
  const images = sample.slice(0, 5).map((p) => p.image_url).filter((u): u is string => !!u);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-sky-50 via-white to-amber-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 overflow-hidden">
      <div className="flex-1 min-h-0 grid grid-cols-6 grid-rows-6 gap-1.5 p-3">
        {images[0] && (
          <div className="col-span-4 row-span-4 relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[0]} alt="" className="w-full h-full object-cover" loading="eager" />
          </div>
        )}
        {images[1] && (
          <div className="col-span-2 row-span-2 relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[1]} alt="" className="w-full h-full object-cover" loading="eager" />
          </div>
        )}
        {images[2] && (
          <div className="col-span-2 row-span-2 relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[2]} alt="" className="w-full h-full object-cover" loading="eager" />
          </div>
        )}
        {images[3] && (
          <div className="col-span-3 row-span-2 relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[3]} alt="" className="w-full h-full object-cover" loading="eager" />
          </div>
        )}
        {images[4] && (
          <div className="col-span-3 row-span-2 relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[4]} alt="" className="w-full h-full object-cover" loading="eager" />
          </div>
        )}
      </div>
      <div className="flex-shrink-0 px-6 py-5 text-center border-t-2 border-sky-700/20 dark:border-sky-400/20 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-700 dark:text-sky-400 mb-1">
          Kategorie
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {name}
        </h2>
      </div>
    </div>
  );
}

// ── Bookmark ──
function Bookmark({ category, side }: { category: Category; side: "left" | "right" }) {
  const name = category.name_de;
  const isRight = side === "right";
  return (
    <div aria-hidden="true" className={`absolute top-8 z-20 select-none pointer-events-none ${isRight ? "-right-3" : "-left-3"}`}>
      <div
        className={`bg-sky-700 dark:bg-sky-600 text-white text-[10px] font-bold uppercase tracking-[0.15em] shadow-lg whitespace-nowrap flex items-center justify-center ${isRight ? "rounded-l-md" : "rounded-r-md"}`}
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          minHeight: "180px",
          width: "32px",
          clipPath: isRight
            ? "polygon(0 0, 100% 0, 85% 50%, 100% 100%, 0 100%)"
            : "polygon(15% 0, 100% 0, 100% 100%, 15% 100%, 0 50%)",
          paddingLeft: isRight ? "4px" : "12px",
          paddingRight: isRight ? "12px" : "4px",
          paddingTop: "10px",
          paddingBottom: "10px",
          transform: isRight ? undefined : "rotate(180deg)",
        }}
      >
        {name}
      </div>
    </div>
  );
}

// ── Grid ──
function Grid({ items, displayFields }: { items: Product[]; displayFields: DisplayFields }) {
  return (
    <div className="h-full grid grid-cols-2 grid-rows-2 gap-3 overflow-hidden">
      {items.map((p) => <Card key={p.id} product={p} displayFields={displayFields} />)}
    </div>
  );
}

// ── Main ──
type PageItem =
  | { kind: "cover"; category: Category; sample: Product[] }
  | { kind: "grid"; items: Product[]; category?: Category };

export default function PublicFlipbook({ products, categories, displayFields }: { products: Product[]; categories: Category[]; displayFields: DisplayFields }) {
  const [currentPage, setCurrentPage] = useState(0);
  const flipRef = useRef<{ pageFlip(): { flipNext(): void; flipPrev(): void } } | null>(null);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories]);

  const pages = useMemo<PageItem[]>(() => {
    const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });
    const groups = new Map<string, Product[]>();
    const uncategorized: Product[] = [];

    for (const p of products) {
      if (p.category_id) {
        const arr = groups.get(p.category_id) ?? [];
        arr.push(p);
        groups.set(p.category_id, arr);
      } else {
        uncategorized.push(p);
      }
    }

    const orderedCatIds = [...groups.keys()].sort((a, b) => {
      const na = catById.get(a)?.name_de ?? "";
      const nb = catById.get(b)?.name_de ?? "";
      return collator.compare(na, nb);
    });

    const result: PageItem[] = [];
    for (const catId of orderedCatIds) {
      const cat = catById.get(catId);
      if (!cat) continue;
      const items = groups.get(catId)!.sort((a, b) => collator.compare(a.name_de, b.name_de));
      result.push({ kind: "cover", category: cat, sample: items });
      for (const ch of chunk(items, PAGE_SIZE)) {
        result.push({ kind: "grid", items: ch, category: cat });
      }
    }
    if (uncategorized.length > 0) {
      const sorted = [...uncategorized].sort((a, b) => collator.compare(a.name_de, b.name_de));
      for (const ch of chunk(sorted, PAGE_SIZE)) {
        result.push({ kind: "grid", items: ch });
      }
    }
    return result;
  }, [products, catById]);

  const totalPages = pages.length;

  function goPrev() { try { flipRef.current?.pageFlip()?.flipPrev(); } catch {} }
  function goNext() { try { flipRef.current?.pageFlip()?.flipNext(); } catch {} }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex flex-col p-3" style={{ height: "100dvh" }} role="region" aria-label="Produktkatalog">
      {/* Header — branding + per-session theme toggle */}
      <div className="flex-shrink-0 relative pb-2">
        <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300 tracking-wide text-center">
          Souvenirs Berlin — Produktkatalog
        </h1>
        <SessionThemeToggle />
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="portrait:aspect-[595/842] landscape:aspect-[1190/842] h-full max-h-full max-w-full">
          <Flipbook
            width={595}
            height={842}
            flipRef={flipRef}
            onFlip={(idx) => setCurrentPage(idx)}
          >
            {pages.map((page, idx) => (
              <FlipPage
                key={idx}
                className={
                  page.kind === "cover"
                    ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"
                }
                isActive={idx === currentPage}
              >
                {page.kind === "cover" ? (
                  <CoverPage category={page.category} sample={page.sample} />
                ) : (
                  <div className="relative h-full">
                    <Grid items={page.items} displayFields={displayFields} />
                    {page.category && (
                      <Bookmark category={page.category} side={idx % 2 === 0 ? "left" : "right"} />
                    )}
                  </div>
                )}
              </FlipPage>
            ))}
          </Flipbook>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center justify-between pt-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentPage <= 0 ? true : undefined}
          suppressHydrationWarning
          className="cursor-pointer h-11 px-5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          <ChevronRightIcon width={16} height={16} className="rotate-180 inline-block" /> Zurück
        </button>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular" role="status" aria-live="polite" aria-atomic="true">
          Seite {currentPage + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={currentPage >= totalPages - 1 ? true : undefined}
          suppressHydrationWarning
          className="cursor-pointer h-11 px-5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          Weiter <ChevronRightIcon width={16} height={16} className="inline-block" />
        </button>
      </div>
    </div>
  );
}
