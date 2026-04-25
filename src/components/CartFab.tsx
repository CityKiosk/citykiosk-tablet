"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cartStore";
import { useI18n } from "./I18nProvider";
import { ShoppingCartIcon } from "./icons";
import CartSheet from "./CartSheet";

export default function CartFab() {
  const { totalCount } = useCart();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Show cart only on catalog (browse is view-only; settings/orders/customers/stock are admin)
  if (pathname.startsWith("/browse") || pathname.startsWith("/settings") || pathname.startsWith("/orders") || pathname.startsWith("/customers") || pathname.startsWith("/stock")) return null;
  if (totalCount === 0 && !open) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.catalog.cartView}
        aria-expanded={open}
        className="cursor-pointer fixed right-5 z-40 inline-flex items-center gap-2.5 h-14 pl-4 pr-5 bg-sky-700 hover:bg-sky-800 text-white rounded-full shadow-[0_8px_24px_rgba(3,105,161,0.35)] hover:shadow-[0_12px_32px_rgba(3,105,161,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 transition-all"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <ShoppingCartIcon width={20} height={20} />
        <span className="font-semibold text-sm">{t.catalog.cartView}</span>
        <span className="tabular inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-white text-sky-700 text-xs font-bold">
          {totalCount}
        </span>
      </button>
      <CartSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
