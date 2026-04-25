import { Order, Locale } from "./types";
import { formatDateTime, formatPrice, dict } from "./i18n";

function safeFileBase(order: Order, locale: Locale): string {
  const date = new Date(order.createdAt).toISOString().slice(0, 10);
  const slug = order.shopName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

export async function previewOrderPdf(order: Order, locale: Locale): Promise<void> {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (
    autoTableMod as unknown as {
      default: (doc: unknown, opts: unknown) => void;
    }
  ).default;

  // Open preview window early (browsers may block if async delayed)
  const previewWin = window.open("", "_blank");

  const t = dict[locale];
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Preload images
  const imageMap = new Map<string, string | null>();
  await Promise.all(
    order.items.map(async (i) => {
      if (!imageMap.has(i.productImage)) {
        imageMap.set(i.productImage, await loadImageAsDataUrl(i.productImage));
      }
    })
  );

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(t.order.title, 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateTime(order.createdAt, locale), 196, 18, { align: "right" });

  // Customer
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(order.shopName, 14, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(order.customerName, 14, 35);

  // Table: Art.-Nr. | Bild | Bezeichnung | Stück | Preis | Gesamtpreis
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
    "", // image placeholder
    [i.productName, i.productDescription].filter(Boolean).join("\n"),
    String(i.quantity),
    formatPrice(i.price, locale),
    formatPrice(i.price * i.quantity, locale),
  ]);

  const imgSize = 34;
  const pageHeight = doc.internal.pageSize.getHeight();
  autoTable(doc, {
    startY: 42,
    head: [headers],
    body: rows,
    rowPageBreak: "avoid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2, minCellHeight: imgSize + 3, valign: "middle" },
    headStyles: { fillColor: [3, 105, 161], textColor: 255, fontStyle: "bold", minCellHeight: 8 },
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
      if (data.section === "body" && data.column.index === 1) {
        const item = order.items[data.row.index];
        if (!item) return;
        const img = imageMap.get(item.productImage);
        if (!img) return;
        const cx = data.cell.x + (data.cell.width - imgSize) / 2;
        const cy = data.cell.y + (data.cell.height - imgSize) / 2;
        // Skip if image would overflow page bottom (split row remnant)
        if (cy + imgSize > pageHeight - 10) return;
        try {
          doc.addImage(img, "JPEG", cx, cy, imgSize, imgSize, undefined, "FAST");
        } catch {
          // Ignore failed image adds
        }
      }
    },
  });

  type DocWithLastTable = typeof doc & { lastAutoTable?: { finalY: number } };
  const finalY = (doc as DocWithLastTable).lastAutoTable?.finalY ?? 60;
  const labelGross = "Gesamt";

  let y = finalY + 8;
  // Net + VAT breakdown for orders that carry a tax rate (legacy orders
  // have taxRate=0; collapse to a single line in that case).
  if (order.taxRate > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Zwischensumme", 140, y);
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
  doc.text(labelGross, 140, y);
  doc.text(formatPrice(order.grossTotal), 196, y, { align: "right" });

  const fileName = `${safeFileBase(order, locale)}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  if (previewWin && !previewWin.closed) {
    previewWin.location.href = url;
    previewWin.document.title = fileName;
  } else {
    // Popup blocked — fallback to direct download
    doc.save(fileName);
    URL.revokeObjectURL(url);
    return;
  }
  // Revoke later so preview window can load
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Legacy export kept for backward compat — now triggers preview
export const downloadOrderPdf = previewOrderPdf;

/** Generate PDF as File object (for Web Share API) */
export async function generateOrderPdfFile(order: Order, locale: Locale): Promise<File> {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (
    autoTableMod as unknown as {
      default: (doc: unknown, opts: unknown) => void;
    }
  ).default;

  const t = dict[locale];
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const imageMap = new Map<string, string | null>();
  await Promise.all(
    order.items.map(async (i) => {
      if (!imageMap.has(i.productImage)) {
        imageMap.set(i.productImage, await loadImageAsDataUrl(i.productImage));
      }
    })
  );

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(t.order.title, 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateTime(order.createdAt, locale), 196, 18, { align: "right" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(order.shopName, 14, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(order.customerName, 14, 35);

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
    "",
    [i.productName, i.productDescription].filter(Boolean).join("\n"),
    String(i.quantity),
    formatPrice(i.price, locale),
    formatPrice(i.price * i.quantity, locale),
  ]);

  const imgSize2 = 34;
  const pageHeight2 = doc.internal.pageSize.getHeight();
  autoTable(doc, {
    startY: 42,
    head: [headers],
    body: rows,
    rowPageBreak: "avoid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2, minCellHeight: imgSize2 + 3, valign: "middle" },
    headStyles: { fillColor: [3, 105, 161], textColor: 255, fontStyle: "bold", minCellHeight: 8 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: imgSize2 + 4 },
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
      if (data.section === "body" && data.column.index === 1) {
        const item = order.items[data.row.index];
        if (!item) return;
        const img = imageMap.get(item.productImage);
        if (!img) return;
        const cx = data.cell.x + (data.cell.width - imgSize2) / 2;
        const cy = data.cell.y + (data.cell.height - imgSize2) / 2;
        if (cy + imgSize2 > pageHeight2 - 10) return;
        try {
          doc.addImage(img, "JPEG", cx, cy, imgSize2, imgSize2, undefined, "FAST");
        } catch { /* ignore */ }
      }
    },
  });

  type DocWithLastTable = typeof doc & { lastAutoTable?: { finalY: number } };
  const finalY = (doc as DocWithLastTable).lastAutoTable?.finalY ?? 60;
  let y = finalY + 8;
  if (order.taxRate > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Zwischensumme", 140, y);
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

  const fileName = `${safeFileBase(order, locale)}.pdf`;
  const blob = doc.output("blob");
  return new File([blob], fileName, { type: "application/pdf" });
}
