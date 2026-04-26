"use client";

// ============================================================================
// BrowseCatalogClient — Customer-facing flipbook catalog (view-only)
// ============================================================================
// Shop owner shows products to customer. NO navigation, NO add-to-cart here.
// Cart actions happen in /catalog (admin side).
// ============================================================================

import { useEffect, useMemo, useRef, useState, memo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useI18n } from "@/components/I18nProvider";
import { formatPrice, getProductName } from "@/lib/i18n";
import type { Category, Product } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { FlipPage } from "@/components/Flipbook";
import { useDisplayFields } from "@/components/DisplayFieldsProvider";
import { PackageIcon, ChevronRightIcon, XIcon, ShareIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { getOrCreateShareLink } from "./actions";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

const Flipbook = dynamic(() => import("@/components/Flipbook"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
  ),
});

type ServerCategory = {
  id: string;
  slug: string;
  name_de: string;
  sort_order: number;
};

type ServerProduct = {
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

const PAGE_SIZE = 6;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function BrowseCardImpl({ product, category: _category }: { product: Product; category?: Category }) {
  const { t } = useI18n();
  const { fields } = useDisplayFields("browse");
  const name = getProductName(product, _category);
  const showSku = fields.sku && !!product.sku;
  const showDimensions = fields.dimensions && !!product.dim;
  const showPackaging = fields.packagingUnit && !!product.ve;
  const showDescription = fields.description && !!product.description;
  const showMeta = showDimensions || showPackaging;

  return (
    <article className="h-full flex flex-col rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-card">
      <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 overflow-hidden p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={name}
          loading="eager"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-shrink-0 px-3 py-2 text-center">
        {fields.name && (
          <h3 className="font-semibold text-xs text-slate-900 dark:text-slate-50 leading-tight line-clamp-1 tabular">
            {name}
          </h3>
        )}
        {showSku && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular">{t.product.artNr} {product.sku}</div>
        )}
        {showMeta && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex justify-center gap-2 tabular">
            {showDimensions && <span>{product.dim}</span>}
            {showPackaging && <span>VE {product.ve}</span>}
          </div>
        )}
        {showDescription && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{product.description}</div>
        )}
        {fields.price && (
          <span className="tabular text-sm font-semibold text-slate-900 dark:text-slate-50 block mt-0.5">
            {formatPrice(product.price)}
          </span>
        )}
      </div>
    </article>
  );
}

const BrowseCard = memo(BrowseCardImpl, (a, b) =>
  a.product.id === b.product.id &&
  a.product.image === b.product.image &&
  a.product.price === b.product.price &&
  a.product.customName === b.product.customName &&
  a.category?.id === b.category?.id,
);

// Physical bookmark tab sticking out from page edge; side depends on page parity
function CategoryBookmark({ category, side }: { category: ServerCategory; side: "left" | "right" }) {
  const name = category.name_de;
  const isRight = side === "right";
  return (
    <div
      aria-hidden="true"
      className={`absolute top-8 z-20 select-none pointer-events-none ${isRight ? "-right-3" : "-left-3"}`}
    >
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

// Magazine-style category cover page: big title + asymmetric image mosaic
function CategoryCover({ category, sample }: { category: ServerCategory; sample: ServerProduct[] }) {
  const name = category.name_de;
  const images = sample.slice(0, 5).map((p) => p.image_url).filter((u): u is string => !!u);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-sky-50 via-white to-amber-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 relative overflow-hidden">
      {/* Image mosaic — asymmetric layout */}
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

      {/* Title — magazine cover style */}
      <div className="flex-shrink-0 px-6 py-5 text-center border-t-2 border-sky-700/20 dark:border-sky-400/20 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-700 dark:text-sky-400 mb-1">
          Kategorie
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50" style={{ fontVariationSettings: '"wght" 700' }}>
          {name}
        </h2>
      </div>
    </div>
  );
}

function PageGrid({ items, catById }: { items: ServerProduct[]; catById: Map<string, ServerCategory> }) {
  return (
    <div className="h-full grid grid-cols-2 grid-rows-3 gap-3">
      {items.map((p) => {
        const cat = p.category_id ? catById.get(p.category_id) : undefined;
        return (
          <BrowseCard
            key={p.id}
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
          />
        );
      })}
    </div>
  );
}

export function BrowseCatalogClient({ categories, products }: { categories: ServerCategory[]; products: ServerProduct[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [currentPage, setCurrentPage] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const flipRef = useRef<{ pageFlip(): { flipNext(): void; flipPrev(): void; turnToPage(n: number): void } } | null>(null);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories]);

  // Group products by category, sort within each, and interleave with cover pages
  type PageItem =
    | { kind: "cover"; category: ServerCategory; sample: ServerProduct[] }
    | { kind: "grid"; items: ServerProduct[]; category?: ServerCategory };

  const pages = useMemo<PageItem[]>(() => {
    const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

    // Group products by category id
    const groups = new Map<string, ServerProduct[]>();
    const uncategorized: ServerProduct[] = [];
    for (const p of products) {
      if (p.category_id) {
        const arr = groups.get(p.category_id) ?? [];
        arr.push(p);
        groups.set(p.category_id, arr);
      } else {
        uncategorized.push(p);
      }
    }

    // Order categories by their display name
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
      // Cover page
      result.push({ kind: "cover", category: cat, sample: items });
      // Product pages
      for (const chunkItems of chunk(items, PAGE_SIZE)) {
        result.push({ kind: "grid", items: chunkItems, category: cat });
      }
    }
    // Uncategorized bucket at the end
    if (uncategorized.length > 0) {
      const sorted = [...uncategorized].sort((a, b) => collator.compare(a.name_de, b.name_de));
      for (const chunkItems of chunk(sorted, PAGE_SIZE)) {
        result.push({ kind: "grid", items: chunkItems });
      }
    }
    return result;
  }, [products, catById]);

  const totalPages = pages.length;

  function goPrev() { try { flipRef.current?.pageFlip()?.flipPrev(); } catch {} }
  function goNext() { try { flipRef.current?.pageFlip()?.flipNext(); } catch {} }

  // Keyboard navigation for accessibility
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-slate-50 dark:bg-slate-950 p-3"
      style={{ height: "100dvh" }}
      role="region"
      aria-label={t.nav.browse}
    >
      {/* Minimal top bar — share + exit */}
      <div className="flex-shrink-0 flex items-center justify-end gap-2 pb-2">
        <button
          type="button"
          disabled={sharing}
          onClick={async () => {
            setSharing(true);
            try {
              const result = await getOrCreateShareLink();
              if (result.error) { toast.show(result.error); return; }
              setShareUrl(`${window.location.origin}/v/${result.token}`);
            } catch {
              toast.show("Fehler beim Teilen");
            } finally {
              setSharing(false);
            }
          }}
          className="cursor-pointer w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 disabled:opacity-60"
          aria-label="Katalog-Link teilen"
        >
          <ShareIcon width={18} height={18} />
        </button>
        <Link
          href="/catalog"
          aria-label={t.common.close}
          className="cursor-pointer w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          <XIcon width={18} height={18} />
        </Link>
      </div>
      {products.length === 0 ? (
        <EmptyState
          icon={<PackageIcon width={24} height={24} />}
          title={t.browse.noProducts}
          actionLabel={t.browse.addingSoon}
        />
      ) : (
        <>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div
              className="portrait:aspect-[595/842] landscape:aspect-[1190/842] h-full max-h-full max-w-full"
            >
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
                      <CategoryCover category={page.category} sample={page.sample} />
                    ) : (
                      <div className="relative h-full">
                        <PageGrid items={page.items} catById={catById} />
                        {page.category && (
                          <CategoryBookmark
                            category={page.category}
                            side={idx % 2 === 0 ? "left" : "right"}
                          />
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
              disabled={currentPage === 0}
              className="cursor-pointer h-11 px-5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            >
              <ChevronRightIcon width={16} height={16} className="rotate-180 inline-block" />{" "}
              {t.browse.back}
            </button>
            <span
              className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {t.browse.page(currentPage + 1, totalPages)}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={currentPage >= totalPages - 1}
              className="cursor-pointer h-11 px-5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            >
              {t.browse.next}{" "}
              <ChevronRightIcon width={16} height={16} className="inline-block" />
            </button>
          </div>
        </>
      )}

      {/* QR Code + Link Share Modal */}
      {shareUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => { if (e.key === "Escape") setShareUrl(null); }}
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShareUrl(null)} aria-hidden="true" />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full mx-4 text-center" tabIndex={-1} ref={(el) => el?.focus()}>
            <button
              type="button"
              onClick={() => setShareUrl(null)}
              className="absolute top-3 right-3 cursor-pointer w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={t.common.close}
            >
              <XIcon width={16} height={16} />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">Katalog teilen</h3>
            <div className="flex justify-center mb-4 p-4 bg-white rounded-xl">
              <QRCodeSVG value={shareUrl} size={200} level="M" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 break-all font-mono">{shareUrl}</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.show("Link kopiert!");
                } catch {
                  toast.show("Link konnte nicht kopiert werden");
                }
              }}
              className="cursor-pointer w-full h-11 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
            >
              Link kopieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
