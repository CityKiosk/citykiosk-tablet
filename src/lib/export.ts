import { Order, Locale } from "./types";
import { formatDateTime, formatPrice, dict } from "./i18n";

// 10 items must fit on a single A4 page. With cellPadding 2mm top/bottom,
// imgSize 18mm gives a row height of ~22mm. 10 × 22 = 220mm, plus 8mm head =
// 228mm — well under the ~245mm body window we get after the page header.
const ITEMS_PER_PAGE = 10;
const LOGO_PATH = "/logo-192.png";
const IMG_SIZE = 18;
const ROW_MIN_HEIGHT = IMG_SIZE + 4;
// Top margin reserved on every page for the logo + title block. autoTable
// uses this on continuation pages, so the header zone never gets overdrawn.
const TABLE_TOP_MARGIN = 42;

function safeFileBase(order: Order, locale: Locale): string {
  const date = new Date(order.createdAt).toISOString().slice(0, 10);
  const slug = order.shopName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "order";
  const prefix = locale === "de" ? "Bestellung" : "Siparis";
  return `${prefix}_${date}_${slug}`;
}

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

type JsPdf = import("jspdf").default;
type AutoTableFn = (doc: unknown, opts: unknown) => void;

async function buildOrderPdf(order: Order, locale: Locale): Promise<JsPdf> {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableMod as unknown as { default: AutoTableFn }).default;
  const t = dict[locale];

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Preload product images + logo in parallel.
  const imageMap = new Map<string, string | null>();
  const [logo] = await Promise.all([
    loadImageAsDataUrl(LOGO_PATH),
    ...order.items.map(async (i) => {
      if (!imageMap.has(i.productImage)) {
        imageMap.set(i.productImage, await loadImageAsDataUrl(i.productImage));
      }
    }),
  ]);

  const headers = [
    "Art.-Nr.",
    locale === "de" ? "Bild" : "Görsel",
    locale === "de" ? "Bezeichnung" : "Açıklama",
    locale === "de" ? "Stück" : "Adet",
    locale === "de" ? "Preis" : "Fiyat",
    locale === "de" ? "Gesamtpreis" : "Toplam",
  ];

  const rows = order.items.map((i) => [
    i.productSku || "",
    "", // image placeholder — drawn via didDrawCell
    [i.productName, i.productDescription].filter(Boolean).join("\n"),
    String(i.quantity),
    formatPrice(i.price, locale),
    formatPrice(i.price * i.quantity, locale),
  ]);

  const expectedPageCount = Math.max(1, Math.ceil(order.items.length / ITEMS_PER_PAGE));
  const pageHeight = doc.internal.pageSize.getHeight();

  autoTable(doc, {
    startY: TABLE_TOP_MARGIN,
    margin: { top: TABLE_TOP_MARGIN, right: 14, bottom: 14, left: 14 },
    head: [headers],
    body: rows,
    rowPageBreak: "avoid",
    pageBreak: "auto",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2,
      minCellHeight: ROW_MIN_HEIGHT,
      valign: "middle",
    },
    headStyles: {
      fillColor: [3, 105, 161],
      textColor: 255,
      fontStyle: "bold",
      minCellHeight: 8,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: IMG_SIZE + 4 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 16, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
    },
    didDrawPage: (data: { pageNumber: number }) => {
      // Logo + title repeated on every page; customer block only on page 1.
      if (logo) {
        try {
          doc.addImage(logo, "PNG", 14, 10, 24, 24);
        } catch {
          // Ignore logo embed failures.
        }
      }
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(t.order.title, 42, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(formatDateTime(order.createdAt, locale), 196, 20, { align: "right" });

      if (data.pageNumber === 1) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(order.shopName, 42, 30);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(order.customerName, 42, 35);
      }
    },
    didDrawCell: (data: {
      section: string;
      column: { index: number };
      row: { index: number };
      cell: { x: number; y: number; width: number; height: number };
    }) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const item = order.items[data.row.index];
      if (!item) return;
      const img = imageMap.get(item.productImage);
      if (!img) return;
      const cx = data.cell.x + (data.cell.width - IMG_SIZE) / 2;
      const cy = data.cell.y + (data.cell.height - IMG_SIZE) / 2;
      if (cy + IMG_SIZE > pageHeight - 10) return;
      try {
        doc.addImage(img, "JPEG", cx, cy, IMG_SIZE, IMG_SIZE, undefined, "FAST");
      } catch {
        // Ignore image embed failures.
      }
    },
  });

  type DocWithLastTable = JsPdf & { lastAutoTable?: { finalY: number } };
  const finalY = (doc as DocWithLastTable).lastAutoTable?.finalY ?? 60;

  // Totals: rendered under the last row of the (final) table page. autoTable
  // already moved the cursor to the last page, so this naturally lands there.
  let y = finalY + 8;

  // Item count summary — same wording as the cart's "X Artikel (Y Sorten)"
  // line so the PDF reads consistent with the on-screen Bestellung.
  const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const totalSorten = order.items.length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Artikel insgesamt: ${totalQty} Stück (${totalSorten} Sorten)`,
    14,
    y,
  );

  if (order.taxRate > 0) {
    // Show the pre-discount net so the receipt reflects what the customer
    // would have paid without the rabate — keeps `order.total` (post-discount
    // net) semantics consistent with the rest of the app.
    const subtotalBeforeDiscount = Math.round((order.total + (order.discountAmount ?? 0)) * 100) / 100;
    doc.text("Zwischensumme (netto)", 140, y);
    doc.text(formatPrice(subtotalBeforeDiscount), 196, y, { align: "right" });
    y += 5;
    if (order.discountPct && order.discountPct > 0) {
      doc.text(`Rabatt ${order.discountPct}%`, 140, y);
      doc.text(`-${formatPrice(order.discountAmount)}`, 196, y, { align: "right" });
      y += 5;
    }
    doc.text(`MwSt ${order.taxRate}%`, 140, y);
    doc.text(formatPrice(order.taxAmount), 196, y, { align: "right" });
    y += 7;
  } else {
    y += 2;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Gesamt", 140, y);
  doc.text(formatPrice(order.grossTotal), 196, y, { align: "right" });

  // Stamp "X / Y" on every page now that the total page count is known. Done
  // as a second pass because autoTable's didDrawPage doesn't expose the final
  // total — only the running pageNumber.
  const totalPages = doc.getNumberOfPages();
  if (totalPages > 1 || expectedPageCount > 1) {
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`${i} / ${totalPages}`, 196, 26, { align: "right" });
    }
  }

  return doc;
}

export async function previewOrderPdf(order: Order, locale: Locale): Promise<void> {
  // Open preview window early — async work below would otherwise trip popup
  // blockers that require a same-tick window.open from the user gesture.
  const previewWin = window.open("", "_blank");

  const doc = await buildOrderPdf(order, locale);
  const fileName = `${safeFileBase(order, locale)}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  if (previewWin && !previewWin.closed) {
    previewWin.location.href = url;
    previewWin.document.title = fileName;
  } else {
    doc.save(fileName);
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const downloadOrderPdf = previewOrderPdf;

/** Generate PDF as a File for the Web Share API. */
export async function generateOrderPdfFile(order: Order, locale: Locale): Promise<File> {
  const doc = await buildOrderPdf(order, locale);
  const fileName = `${safeFileBase(order, locale)}.pdf`;
  const blob = doc.output("blob");
  return new File([blob], fileName, { type: "application/pdf" });
}
