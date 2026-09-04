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
import LegalPage, { LEGAL_PAGE_COUNT } from "@/components/LegalPage";
import { useDisplayFields } from "@/components/DisplayFieldsProvider";
import { PackageIcon, ChevronRightIcon, XIcon, ShareIcon, MenuIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { revokeShareLink } from "./actions";
import ShareLinkPinDialog from "./ShareLinkPinDialog";
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
  // price/sku/dimensions/packaging_unit/description_de können serverseitig NULL
  // sein, wenn das Feld im browse-Scope ausgeblendet ist (page.tsx nullt sie,
  // damit sie nicht in der RSC-Payload landen). Der Render blendet dasselbe Feld
  // ohnehin per useDisplayFields aus, daher wird ein genulltes Feld nie gezeigt.
  price: number | null;
  image_url: string | null;
  category_id: string | null;
  dimensions: string | null;
  packaging_unit: number | null;
  sku: string | null;
  description_de: string | null;
  sort_order: number;
};

const PAGE_SIZE = 4;

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
    <article className="h-full flex flex-col rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-card p-2">
      <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 overflow-hidden rounded-lg">
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

// Magazine-style category cover page: full-bleed hero photo + dramatic title overlay
function CategoryCover({ category, sample }: { category: ServerCategory; sample: ServerProduct[] }) {
  const { t } = useI18n();
  const name = category.name_de;
  const hero = sample.find((p) => !!p.image_url)?.image_url ?? null;
  const productCount = sample.length;

  return (
    <div className="relative h-full overflow-hidden bg-slate-900">
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hero}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/20"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 px-8 pb-10 sm:pb-12 text-white">
        <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-300 mb-3">
          {t.browse.categoryEyebrow}
        </div>
        <h2 className="text-5xl sm:text-6xl font-bold uppercase tracking-tight leading-[0.9] mb-4 drop-shadow-lg">
          {name}
        </h2>
        <div className="flex items-center gap-3 text-xs sm:text-sm text-white/80">
          <span className="h-px w-10 bg-amber-300" aria-hidden="true" />
          <span className="font-medium tabular">{t.browse.productCount(productCount)}</span>
        </div>
      </div>
    </div>
  );
}

function PageGrid({ items, catById }: { items: ServerProduct[]; catById: Map<string, ServerCategory> }) {
  return (
    <div className="h-full grid grid-cols-2 grid-rows-2 gap-3">
      {items.map((p) => {
        const cat = p.category_id ? catById.get(p.category_id) : undefined;
        return (
          <BrowseCard
            key={p.id}
            product={{
              id: p.id,
              image: p.image_url || "",
              categoryId: p.category_id || "",
              // NULL (Feld ausgeblendet) → 0; der Render zeigt den Preis dann
              // ohnehin nicht (fields.price ist false). Kein sichtbarer 0-Preis.
              price: p.price ?? 0,
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
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const flipRef = useRef<{ pageFlip(): { flipNext(): void; flipPrev(): void; turnToPage(n: number): void } } | null>(null);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories]);

  // Group products by category, sort within each, and interleave with cover pages
  type PageItem =
    | { kind: "cover"; category: ServerCategory; sample: ServerProduct[] }
    | { kind: "grid"; items: ServerProduct[]; category?: ServerCategory }
    | { kind: "legal"; part: 1 | 2 };

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
    // Legal pages (2) at the very end
    if (result.length > 0) {
      for (let p = 1; p <= LEGAL_PAGE_COUNT; p++) {
        result.push({ kind: "legal", part: p as 1 | 2 });
      }
    }
    return result;
  }, [products, catById]);

  const totalPages = pages.length;

  // Navigation targets: first page index for each category (cover) + uncategorized bucket + legal
  const navTargets = useMemo(() => {
    const targets: { key: string; label: string; pageIndex: number }[] = [];
    let uncategorizedIdx = -1;
    let legalIdx = -1;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (p.kind === "cover") {
        targets.push({ key: p.category.id, label: p.category.name_de, pageIndex: i });
      } else if (p.kind === "grid" && !p.category && uncategorizedIdx === -1) {
        uncategorizedIdx = i;
      } else if (p.kind === "legal" && p.part === 1) {
        legalIdx = i;
      }
    }
    if (uncategorizedIdx !== -1) {
      targets.push({ key: "__uncategorized__", label: t.browse.uncategorized, pageIndex: uncategorizedIdx });
    }
    if (legalIdx !== -1) {
      targets.push({ key: "__legal__", label: "AGB", pageIndex: legalIdx });
    }
    return targets;
  }, [pages, t.browse.uncategorized]);

  function goPrev() { try { flipRef.current?.pageFlip()?.flipPrev(); } catch {} }
  function goNext() { try { flipRef.current?.pageFlip()?.flipNext(); } catch {} }
  function jumpToPage(idx: number) {
    try { flipRef.current?.pageFlip()?.turnToPage(idx); } catch {}
    setMenuOpen(false);
  }

  // Keyboard navigation for accessibility
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) { setMenuOpen(false); return; }
      if (menuOpen) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuOpen]);

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
          onClick={() => setPinDialogOpen(true)}
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
          <div className="flex-1 min-h-0 flex items-center justify-center relative">
            <div
              className="portrait:aspect-[750/842] landscape:aspect-[1500/842] h-full max-h-full max-w-full"
            >
              <Flipbook
                width={750}
                height={842}
                flipRef={flipRef}
                onFlip={(idx) => setCurrentPage(idx)}
              >
                {pages.map((page, idx) => (
                  <FlipPage
                    key={idx}
                    className={
                      page.kind === "grid"
                        ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
                    }
                    isActive={idx === currentPage}
                  >
                    {page.kind === "cover" ? (
                      <CategoryCover category={page.category} sample={page.sample} />
                    ) : page.kind === "legal" ? (
                      <LegalPage part={page.part} />
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
            {navTargets.length > 0 && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={t.browse.contents}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                className="cursor-pointer absolute left-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center gap-2 py-3 bg-amber-500 dark:bg-amber-400 text-white dark:text-slate-900 shadow-md hover:shadow-lg rounded-r-lg transition-transform duration-150 hover:translate-x-1 focus-visible:translate-x-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                style={{ width: 38, minHeight: 140 }}
              >
                <MenuIcon width={18} height={18} />
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.18em] whitespace-nowrap"
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                >
                  {t.browse.contents}
                </span>
              </button>
            )}
          </div>

          <span
            className="pointer-events-none absolute bottom-3 right-3 z-10 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 backdrop-blur tabular"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentPage + 1} / {totalPages}
          </span>
        </>
      )}

      {/* Contents (categories) overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16"
          role="dialog"
          aria-modal="true"
          aria-label={t.browse.contents}
        >
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm max-h-[80vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.browse.contents}</h2>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t.common.close}
                className="cursor-pointer w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              >
                <XIcon width={16} height={16} />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto py-2">
              {navTargets.map((target) => (
                <li key={target.key}>
                  <button
                    type="button"
                    onClick={() => jumpToPage(target.pageIndex)}
                    className="cursor-pointer w-full flex items-center justify-between gap-3 px-5 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800 transition-colors"
                  >
                    <span className="truncate">{target.label}</span>
                    <ChevronRightIcon width={14} height={14} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* QR Code + Link Share Modal */}
      {pinDialogOpen && (
        <ShareLinkPinDialog
          onClose={() => setPinDialogOpen(false)}
          onReady={(url) => { setShareUrl(url); setPinDialogOpen(false); }}
        />
      )}

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
            <button
              type="button"
              disabled={revoking}
              onClick={async () => {
                setRevoking(true);
                try {
                  const res = await revokeShareLink();
                  if (res.error) { toast.show(res.error); return; }
                  toast.show(t.browse.share.revoked);
                  setShareUrl(null);
                } catch {
                  toast.show(t.pin.saveError);
                } finally {
                  setRevoking(false);
                }
              }}
              className="cursor-pointer mt-2 w-full h-11 rounded-lg text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 transition-colors disabled:opacity-60"
            >
              {t.browse.share.revoke}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
