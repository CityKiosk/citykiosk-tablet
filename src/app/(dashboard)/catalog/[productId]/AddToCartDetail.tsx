"use client";

import { useProductQty } from "@/lib/cartStore";
import { useI18n } from "@/components/I18nProvider";
import QtyControl from "@/components/QtyControl";
import { ShoppingCartIcon } from "@/components/icons";

export default function AddToCartDetail({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [qty, setQty] = useProductQty(productId);
  const { locale } = useI18n();

  return (
    <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
      {qty === 0 ? (
        <button
          type="button"
          onClick={() => setQty(1)}
          className="cursor-pointer inline-flex items-center gap-2 h-12 px-6 bg-sky-700 hover:bg-sky-800 text-white rounded-xl font-semibold text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
        >
          <ShoppingCartIcon width={18} height={18} />
          {locale === "de" ? "In den Warenkorb" : "Sepete ekle"}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <QtyControl value={qty} onChange={setQty} label={productName} size="lg" />
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {locale === "de" ? "Im Warenkorb" : "Sepette"}
          </span>
        </div>
      )}
    </div>
  );
}
