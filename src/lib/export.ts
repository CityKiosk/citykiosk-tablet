import { Order, Locale } from "./types";
import { formatDateTime, formatPrice, dict } from "./i18n";

const ITEMS_PER_PAGE = 10;
const LOGO_PATH = "/logo-192.png";

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Logo + title + per-page metadata. Drawn at the top of every PDF page so a
 *  multi-page Bestellung still carries the SOCK OFF brand on each sheet. */
function drawPageHeader(
  doc: JsPdf,
  order: Order,
  locale: Locale,
  logo: string | null,
  pageIndex: number,
  pageCount: number,
): number {
  const t = dict[locale];

  if (logo) {
    try {
      // 24×24mm square in the top-left, leaving the title clear of the artwork.
      doc.addImage(logo, "PNG", 14, 10, 24, 24);
    } catch {
      // Ignore failed logo embed; the rest of the header still renders.
    }
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(t.order.title, 42, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateTime(order.createdAt, locale), 196, 20, { align: "right" });
  if (pageCount > 1) {
    doc.setFontSize(9);
    doc.text(`${pageIndex + 1} / ${pageCount}`, 196, 26, { align: "right" });
  }

  // Customer block only on the first page — subsequent pages start the table
  // higher so we get a clean "continuation" look.
  if (pageIndex === 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(order.shopName, 42, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(order.customerName, 42, 35);
    return 42; // table startY for first page
  }
  return 38; // table startY for continuation pages
}

async function buildOrderPdf(order: Order, locale: Locale): Promise<JsPdf> {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableMod as unknown as { default: AutoTableFn }).default;

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

  const allRows = order.items.map((i) => [
    i.productSku || "",
    "", // image placeholder — drawn via didDrawCell
    [i.productName, i.productDescription].filter(Boolean).join("\n"),
    String(i.quantity),
    formatPrice(i.price, locale),
    formatPrice(i.price * i.quantity, locale),
  ]);

  const pages = chunk(allRows, ITEMS_PER_PAGE);
  const pageCount = Math.max(pages.length, 1);
  const imgSize = 34;
  const pageHeight = doc.internal.pageSize.getHeight();

  pages.forEach((pageRows, pageIndex) => {
    if (pageIndex > 0) doc.addPage();
    const startY = drawPageHeader(doc, order, locale, logo, pageIndex, pageCount);
    const rowOffset = pageIndex * ITEMS_PER_PAGE;

    autoTable(doc, {
      startY,
      head: [headers],
      body: pageRows,
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2,
        minCellHeight: imgSize + 3,
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
        1: { cellWidth: imgSize + 4 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 16, halign: "right" },
        4: { cellWidth: 24, halign: "right" },
        5: { cellWidth: 28, halign: "right" },
      },
      didDrawCell: (data: {
        section: string;
        column: { index: number };
        row: { index: number };
        cell: { x: number; y: number; width: number; height: number };
      }) => {
        if (data.section !== "body" || data.column.index !== 1) return;
        // row.index here is local to the current chunk — translate back to the
        // global item index so the image lookup matches.
        const item = order.items[rowOffset + data.row.index];
        if (!item) return;
        const img = imageMap.get(item.productImage);
        if (!img) return;
        const cx = data.cell.x + (data.cell.width - imgSize) / 2;
        const cy = data.cell.y + (data.cell.height - imgSize) / 2;
        if (cy + imgSize > pageHeight - 10) return;
        try {
          doc.addImage(img, "JPEG", cx, cy, imgSize, imgSize, undefined, "FAST");
        } catch {
          // Ignore failed image adds.
        }
      },
    });
  });

  // Totals — drawn on the last page, under whatever the last autoTable left.
  type DocWithLastTable = JsPdf & { lastAutoTable?: { finalY: number } };
  const finalY = (doc as DocWithLastTable).lastAutoTable?.finalY ?? 60;

  let y = finalY + 8;
  if (order.taxRate > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Zwischensumme (netto)", 140, y);
    doc.text(formatPrice(order.total), 196, y, { align: "right" });
    y += 5;
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
