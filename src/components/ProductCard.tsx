"use client";

import { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Category, Product } from "@/lib/types";
import { formatPrice, getCategoryName, getProductName } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";
import { useProductQty } from "@/lib/cartStore";
import { useDisplayFields } from "./DisplayFieldsProvider";
import QtyControl from "./QtyControl";

function ProductCardImpl({
  product,
  category,
  isCustom = false,
  priority = false,
  gridCols = 2,
}: {
  product: Product;
  category?: Category;
  isCustom?: boolean;
  priority?: boolean;
  gridCols?: 2 | 3;
}) {
  const { t, locale } = useI18n();
  const [qty, setQty] = useProductQty(product.id);
  const { fields } = useDisplayFields("catalog");
  const name = getProductName(product, category, locale);
  const sizes = gridCols === 3
    ? "(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
    : "(max-width:640px) 100vw, 50vw";

  return (
    <article
      className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col overflow-hidden [content-visibility:auto]"
      style={{ containIntrinsicSize: "320px" }}
    >
      {/* Detail link is limited to the image area. Tapping on the text rows
          or the qty control area no longer navigates away — this matters when
          the qty input has focus and the user taps anywhere on the card to
          dismiss the numeric keyboard. */}
      <Link
        href={`/catalog/${encodeURIComponent(product.id)}`}
        aria-label={t.catalog.detailAria(name)}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-inset rounded-t-2xl"
      >
        <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <Image
            src={product.image}
            alt={name}
            fill
            loading="eager"
            priority={priority}
            quality={70}
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes={sizes}
            unoptimized={product.image.startsWith("data:")}
          />
          {category && (
            <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-300 rounded-md shadow-sm border border-slate-200 dark:border-slate-700">
              {getCategoryName(category, locale)}
            </span>
          )}
          {isCustom && (
            <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500 text-white rounded-md shadow-sm">
              {t.catalog.customBadge}
            </span>
          )}
        </div>
      </Link>
      <div className="p-4 flex-1 flex flex-col gap-1">
        {fields.name && (
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-50 leading-snug line-clamp-2">
            {name}
          </h3>
        )}
        {fields.description && product.description && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-1">{product.description}</p>
        )}
        {fields.dimensions && product.dim && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{t.product.dimensions}: {product.dim}</span>
        )}
        {fields.packagingUnit && product.ve != null && product.ve > 0 && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">VE {product.ve}</span>
        )}
        {fields.sku && product.sku && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{t.product.artNr} {product.sku}</span>
        )}
      </div>
      <div className="px-4 pb-4 flex flex-wrap items-center justify-between gap-2">
        {fields.price && (
          <div className="tabular text-base font-semibold text-slate-900 dark:text-slate-50 whitespace-nowrap">
            {formatPrice(product.price, locale)}
          </div>
        )}
        <QtyControl value={qty} onChange={setQty} label={name} size="sm" />
      </div>
    </article>
  );
}

const ProductCard = memo(ProductCardImpl, (a, b) => {
  return (
    a.product.id === b.product.id &&
    a.product.image === b.product.image &&
    a.product.price === b.product.price &&
    a.product.customName === b.product.customName &&
    a.category?.id === b.category?.id &&
    a.isCustom === b.isCustom &&
    a.priority === b.priority &&
    a.gridCols === b.gridCols
  );
});

export default ProductCard;
