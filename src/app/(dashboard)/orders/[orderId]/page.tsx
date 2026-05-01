"use client";

import { use, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatDateTime, formatPrice } from "@/lib/i18n";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { downloadOrderPdf, generateOrderPdfFile } from "@/lib/export";
import { FileTextIcon, Loader2Icon, ReceiptIcon, ShareIcon, Trash2Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { fetchOrderById, deleteOrder, type OrderRow } from "../actions";
import type { Order } from "@/lib/types";

/** Convert Supabase OrderRow to the legacy Order shape used by PDF export */
function toExportOrder(o: OrderRow): Order {
  return {
    id: o.id,
    customerId: o.customer_id ?? "",
    customerName: o.customer_first_name + (o.customer_last_name ? ` ${o.customer_last_name}` : ""),
    shopName: o.customer_shop_name,
    items: o.items.map((i) => ({
      productId: i.product_id ?? "",
      productName: i.product_name_de,
      productImage: i.product_image_url ?? "",
      productSku: i.product_sku ?? undefined,
      productDescription: i.product_description ?? undefined,
      quantity: i.quantity,
      price: i.unit_price,
    })),
    total: o.total,
    taxRate: o.tax_rate,
    taxAmount: o.tax_amount,
    grossTotal: o.gross_total,
    createdAt: o.created_at,
  };
}

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const { t, locale } = useI18n();
  const toast = useToast();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetchOrderById(orderId).then((res) => {
      if (res.data) setOrder(res.data);
      setLoaded(true);
    });
  }, [orderId]);

  async function handleExport() {
    if (!order) return;
    setExporting(true);
    try {
      await downloadOrderPdf(toExportOrder(order), locale);
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    if (!order) return;
    setSharing(true);
    try {
      const file = await generateOrderPdfFile(toExportOrder(order), locale);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${order.customer_shop_name} — ${order.order_number}`,
          files: [file],
        });
      } else {
        // Fallback: mailto with shop email
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email || "";
        const subject = encodeURIComponent(
          `Bestellung ${order.order_number} — ${order.customer_shop_name}`
        );
        const body = encodeURIComponent(
          `Bestellung ${order.order_number}\nKunde: ${order.customer_shop_name}\nGesamt: ${order.gross_total}\n\nPDF wurde heruntergeladen — bitte anhängen.`
        );
        // Download PDF first, then open mailto
        await downloadOrderPdf(toExportOrder(order), locale);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
      }
    } finally {
      setSharing(false);
    }
  }

  function handleDelete() {
    if (!order) return;
    startTransition(async () => {
      const result = await deleteOrder(order.id);
      if (result.error) {
        toast.show(result.error);
        return;
      }
      toast.show(t.orders.deleted);
      window.location.href = "/orders";
    });
  }

  const customerDisplay = (o: OrderRow) =>
    o.customer_first_name + (o.customer_last_name ? ` ${o.customer_last_name}` : "");

  const itemName = (i: OrderRow["items"][number]) => i.product_name_de;

  if (!loaded) {
    return <div className="h-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />;
  }

  if (!order) {
    return (
      <EmptyState
        icon={<ReceiptIcon width={24} height={24} />}
        title={t.orders.notFound}
        actionLabel={t.orders.listTitle}
        actionHref="/orders"
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/orders"
          className="cursor-pointer inline-flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded"
        >
          {t.orders.backToList}
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.orders.detailTitle}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 mt-1">
              {order.customer_shop_name}
            </h1>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{customerDisplay(order)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              {formatDateTime(order.created_at, locale)}
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.order.total}
              </div>
              <div className="tabular text-3xl font-semibold text-slate-900 dark:text-slate-50 mt-1">
                {formatPrice(order.gross_total)}
              </div>
              {order.tax_rate > 0 && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular text-right">
                  {t.catalog.cartSubtotal} {formatPrice(order.total)} · {t.catalog.cartTaxLine(order.tax_rate)} {formatPrice(order.tax_amount)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="cursor-pointer inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 disabled:opacity-60 transition-colors"
              >
                {exporting ? (
                  <Loader2Icon width={16} height={16} className="animate-spin" />
                ) : (
                  <FileTextIcon width={16} height={16} />
                )}
                {t.orders.exportPdf}
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                aria-label="Teilen"
                className="cursor-pointer inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 disabled:opacity-60 transition-colors"
              >
                {sharing ? (
                  <Loader2Icon width={16} height={16} className="animate-spin" />
                ) : (
                  <ShareIcon width={16} height={16} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                disabled={isPending}
                aria-label={t.orders.delete}
                className="cursor-pointer inline-flex items-center justify-center w-10 h-10 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 transition-colors disabled:opacity-60"
              >
                <Trash2Icon width={16} height={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
        {/* Desktop table */}
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-5 py-3" colSpan={2}>
                {t.orders.columns.items}
              </th>
              <th className="px-5 py-3 text-right">{t.orders.lineUnit}</th>
              <th className="px-5 py-3 text-right">{t.orders.lineQty}</th>
              <th className="px-5 py-3 text-right">{t.orders.lineSubtotal}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {order.items.map((i) => (
              <tr key={i.id}>
                <td className="px-5 py-4 w-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.product_image_url ?? ""}
                    alt=""
                    width={144}
                    height={144}
                    loading="lazy"
                    className="w-36 h-36 rounded-lg object-contain bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-900 dark:text-slate-50">{itemName(i)}</div>
                  {i.product_description && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{i.product_description}</div>
                  )}
                  {i.product_sku && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Art.-Nr. {i.product_sku}</div>
                  )}
                </td>
                <td className="tabular px-5 py-3 text-right text-slate-600 dark:text-slate-400">
                  {formatPrice(i.unit_price)}
                </td>
                <td className="tabular px-5 py-3 text-right text-slate-700 dark:text-slate-300">{i.quantity}</td>
                <td className="tabular px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-50">
                  {formatPrice(i.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {order.tax_rate > 0 && (
              <>
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  <td className="px-5 py-2 text-right text-xs text-slate-500 dark:text-slate-400" colSpan={4}>
                    {t.catalog.cartSubtotal}
                  </td>
                  <td className="tabular px-5 py-2 text-right text-xs text-slate-600 dark:text-slate-400">
                    {formatPrice(order.total)}
                  </td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  <td className="px-5 py-2 text-right text-xs text-slate-500 dark:text-slate-400" colSpan={4}>
                    {t.catalog.cartTaxLine(order.tax_rate)}
                  </td>
                  <td className="tabular px-5 py-2 text-right text-xs text-slate-600 dark:text-slate-400">
                    {formatPrice(order.tax_amount)}
                  </td>
                </tr>
              </>
            )}
            <tr className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
              <td className="px-5 py-3" colSpan={4}>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t.order.total}
                </span>
              </td>
              <td className="tabular px-5 py-3 text-right text-base font-semibold text-slate-900 dark:text-slate-50">
                {formatPrice(order.gross_total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Mobile cards */}
        <ul className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-3 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={i.product_image_url ?? ""}
                alt=""
                width={72}
                height={72}
                loading="lazy"
                className="w-18 h-18 sm:w-24 sm:h-24 rounded-lg object-contain bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-shrink-0"
                style={{ width: "4.5rem", height: "4.5rem" }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-900 dark:text-slate-50 line-clamp-2">
                  {itemName(i)}
                </div>
                {i.product_description && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{i.product_description}</div>
                )}
                {i.product_sku && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Art.-Nr. {i.product_sku}</div>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="tabular">{formatPrice(i.unit_price)}</span>
                  <span>×</span>
                  <span className="tabular font-medium text-slate-700 dark:text-slate-300">{i.quantity}</span>
                </div>
                <div className="tabular text-sm font-semibold text-sky-700 dark:text-sky-400 mt-1">
                  {formatPrice(i.line_total)}
                </div>
              </div>
            </li>
          ))}
          {order.tax_rate > 0 && (
            <>
              <li className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
                <span>{t.catalog.cartSubtotal}</span>
                <span className="tabular">{formatPrice(order.total)}</span>
              </li>
              <li className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
                <span>{t.catalog.cartTaxLine(order.tax_rate)}</span>
                <span className="tabular">{formatPrice(order.tax_amount)}</span>
              </li>
            </>
          )}
          <li className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.order.total}
            </span>
            <span className="tabular text-base font-semibold text-slate-900 dark:text-slate-50">
              {formatPrice(order.gross_total)}
            </span>
          </li>
        </ul>
      </div>

      <ConfirmDialog
        open={confirmDel}
        message={t.orders.deleteConfirm(order.customer_shop_name)}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  );
}
