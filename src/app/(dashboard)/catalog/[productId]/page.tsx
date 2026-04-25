// ============================================================================
// Product Detail Page — View Only (no editing)
// ============================================================================
// Editing is done in Settings → Products tab.
// This page is shown to customers — must be read-only.
// Prev/Next navigation for browsing without going back to catalog.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/i18n";
import { ChevronRightIcon } from "@/components/icons";
import AddToCartDetail from "./AddToCartDetail";

type PageProps = {
  params: Promise<{ productId: string }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { productId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  // Fetch current product (explicit owner_id for defense-in-depth alongside RLS)
  const { data: product } = await supabase
    .from("products")
    .select("*, category:categories(id, name_de)")
    .eq("id", productId)
    .eq("owner_id", user.id)
    .single();

  if (!product) notFound();

  // Fetch all products sorted by category name then product name
  const { data: allProducts } = await supabase
    .from("products")
    .select("id, name_de, image_url, category_id, categories(name_de)")
    .eq("is_active", true)
    .eq("owner_id", user.id)
    .order("name_de", { ascending: true });

  // Sort by category name → product name (numeric-aware, same order as catalog)
  const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });
  const sorted = (allProducts ?? []).sort((a, b) => {
    const catA = (a.categories as { name_de: string } | null)?.name_de ?? "";
    const catB = (b.categories as { name_de: string } | null)?.name_de ?? "";
    const catCmp = collator.compare(catA, catB);
    if (catCmp !== 0) return catCmp;
    return collator.compare(a.name_de, b.name_de);
  });

  const currentIdx = sorted.findIndex((p) => p.id === product.id);
  const prev = currentIdx > 0 ? sorted[currentIdx - 1] : null;
  const next = currentIdx >= 0 && currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;

  const catName = product.category
    ? (product.category as { name_de: string }).name_de
    : null;

  return (
    <div>
      {/* Prefetch prev/next images */}
      {prev?.image_url && <link rel="prefetch" href={prev.image_url} as="image" />}
      {next?.image_url && <link rel="prefetch" href={next.image_url} as="image" />}

      {/* Top nav: back + prev/next */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/catalog"
          className="inline-flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 rounded"
        >
          ← Katalog
        </Link>
        <div className="flex items-center gap-2">
          {prev ? (
            <Link
              href={`/catalog/${prev.id}`}
              className="cursor-pointer inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRightIcon width={14} height={14} className="rotate-180" />
              {prev.name_de}
            </Link>
          ) : (
            <span className="h-9" />
          )}
          {next ? (
            <Link
              href={`/catalog/${next.id}`}
              className="cursor-pointer inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {next.name_de}
              <ChevronRightIcon width={14} height={14} />
            </Link>
          ) : (
            <span className="h-9" />
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="relative bg-slate-100 dark:bg-slate-800 aspect-square md:aspect-auto md:min-h-[420px]">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name_de}
                fill
                className="object-contain p-4"
                sizes="(max-width:768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Kein Bild
              </div>
            )}
          </div>

          {/* Product Info — View Only */}
          <div className="p-6 lg:p-8 space-y-5">
            {catName && (
              <span className="inline-flex px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                {catName}
              </span>
            )}

            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {product.name_de}
            </h1>

            <div className="tabular text-3xl font-bold text-sky-700 dark:text-sky-400">
              {formatPrice(product.price)}
            </div>

            {product.description_de && (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {product.description_de}
              </p>
            )}

            {product.dimensions && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Maße:</span> {product.dimensions}
              </div>
            )}

            {product.packaging_unit && product.packaging_unit > 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">VE:</span> {product.packaging_unit}
              </div>
            )}

            <AddToCartDetail
              productId={product.id}
              productName={product.name_de}
            />

            {product.sku && (
              <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800">
                Art.-Nr.: {product.sku}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
