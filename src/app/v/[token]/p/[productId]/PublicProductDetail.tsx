"use client";

// ============================================================================
// PublicProductDetail — view-only single product page for the share link
// ============================================================================
// No cart, no edit. Big image + all visible fields + back navigation.
// Locale: hardcoded German (matches PublicFlipbook / PublicCatalogList).
// ============================================================================

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/i18n";
import { ChevronLeftIcon, PackageIcon } from "@/components/icons";
import PublicLegalFooter from "../../_components/PublicLegalFooter";
import SessionThemeToggle from "../../_components/SessionThemeToggle";
import type {
  PublicProduct,
  PublicCategory,
  PublicDisplayFields,
} from "../../_data/catalog";

type Props = {
  token: string;
  product: PublicProduct;
  category: PublicCategory | null;
  displayFields: PublicDisplayFields;
};

export default function PublicProductDetail({
  token,
  product,
  category,
  displayFields,
}: Props) {
  const showSku = displayFields.sku && !!product.sku;
  const showDimensions = displayFields.dimensions && !!product.dimensions;
  const showPackaging = displayFields.packagingUnit && !!product.packaging_unit;
  const showDescription = displayFields.description && !!product.description_de;

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="h-12 flex items-center justify-between gap-2 px-2">
          <Link
            href={`/v/${token}/m`}
            aria-label="Zurück zum Katalog"
            className="flex-shrink-0 inline-flex items-center gap-1 h-9 px-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
          >
            <ChevronLeftIcon width={18} height={18} />
            <span>Katalog</span>
          </Link>
          <SessionThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3">
        <div className="mt-3 relative aspect-square w-full bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name_de}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300 dark:text-slate-600">
              <PackageIcon width={48} height={48} />
            </div>
          )}
        </div>

        <section className="mt-5 space-y-1">
          {category && (
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-400">
              {category.name_de}
            </div>
          )}
          {displayFields.name && (
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 leading-tight">
              {product.name_de}
            </h1>
          )}
          {displayFields.price && (
            <div className="pt-1 text-2xl font-bold text-sky-700 dark:text-sky-400 tabular">
              {formatPrice(product.price)}
            </div>
          )}
        </section>

        {(showSku || showDimensions || showPackaging) && (
          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {showSku && (
              <Detail label="Art.-Nr." value={product.sku!} />
            )}
            {showDimensions && (
              <Detail label="Maße" value={product.dimensions!} />
            )}
            {showPackaging && (
              <Detail
                label="Verpackungseinheit"
                value={`${product.packaging_unit} Stück`}
              />
            )}
          </dl>
        )}

        {showDescription && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Beschreibung
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {product.description_de}
            </p>
          </section>
        )}
      </main>

      <PublicLegalFooter token={token} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-sm font-medium text-slate-900 dark:text-slate-50 tabular mt-0.5">
        {value}
      </dd>
    </div>
  );
}
