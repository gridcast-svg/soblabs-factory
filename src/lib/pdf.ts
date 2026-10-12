import { jsPDF } from "jspdf";
import { formatMoney, formatNumber, type Layout, type QuoteTotals } from "./led-calc";
import { CATEGORY_LABELS, type Hardware, type LedProduct, type Quote } from "./types";

export type BusinessSettings = {
  company_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

type PdfInput = {
  quote: Quote;
  settings: BusinessSettings | null;
  salesperson: string;
  product: LedProduct | null;
  processor: Hardware | null;
  receiver: Hardware | null;
  processorQty: number;
  layout: Layout | null;
  cabinetDepthMm: number | null;
  mountingDepthMm: number | null;
  totals: QuoteTotals;
};

const MARGIN = 42;
const PAGE_W = 595.28; // A4 portrait points
const PAGE_H = 841.89;

/**
 * Builds the client-facing quotation from an explicit client-safe field set.
 * Supplier costs, exchange rates, profit, markup, margin and internal notes
 * are deliberately never passed into this function's output.
 */
export function buildQuotePdf(input: PdfInput): Blob {
  const { quote, settings, salesperson, product, processor, receiver, layout, totals } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cur = quote.currency;
  let y = MARGIN;

  const ensure = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN - 20) {
      footer(doc, quote);
      doc.addPage();
      y = MARGIN;
    }
  };

  const heading = (text: string) => {
    ensure(34);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20, 24, 34);
    doc.text(text.toUpperCase(), MARGIN, y);
    doc.setDrawColor(200, 208, 220).line(MARGIN, y + 5, PAGE_W - MARGIN, y + 5);
    y += 20;
  };

  const row = (label: string, value: string) => {
    ensure(15);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90, 100, 115);
    doc.text(label, MARGIN, y);
    doc.setTextColor(20, 24, 34);
    doc.text(value, MARGIN + 170, y, { maxWidth: PAGE_W - MARGIN * 2 - 170 });
    y += 14;
  };

  // ---- header -------------------------------------------------------------
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(20, 24, 34);
  doc.text(settings?.company_name || "Soblabs", MARGIN, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110, 120, 135);
  const companyLines = [settings?.address, settings?.phone, settings?.email, settings?.website]
    .filter(Boolean)
    .join("  ·  ");
  if (companyLines) doc.text(companyLines, MARGIN, y + 18);

  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(20, 24, 34);
  doc.text("QUOTATION", PAGE_W - MARGIN, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(70, 80, 95);
  doc.text(
    [
      `Quote ${quote.quote_number}`,
      `Revision ${quote.revision}`,
      `Issued ${quote.issue_date ?? "—"}`,
      `Valid until ${quote.valid_until ?? "—"}`,
    ].join("\n"),
    PAGE_W - MARGIN,
    y + 20,
    { align: "right" },
  );
  y += 62;

  if (quote.is_demo) {
    doc.setFillColor(255, 244, 214);
    doc.rect(MARGIN, y - 10, PAGE_W - MARGIN * 2, 18, "F");
    doc.setFontSize(9).setTextColor(150, 100, 0);
    doc.text("DEMONSTRATION QUOTE — not for client issue", MARGIN + 6, y + 2);
    y += 24;
  }

  heading("Customer & project");
  row("Customer / company", quote.customer_company || "—");
  row("Contact", [quote.contact_name, quote.contact_email, quote.contact_phone].filter(Boolean).join(" · ") || "—");
  row("Project", quote.project_name || "—");
  row("Salesperson", salesperson);
  y += 6;

  // ---- drawings -----------------------------------------------------------
  if (layout && product) {
    heading("Display drawings");
    ensure(250);
    drawFrontElevation(doc, MARGIN, y, PAGE_W - MARGIN * 2 - 150, 200, layout, product);
    drawSideProfile(
      doc,
      PAGE_W - MARGIN - 130,
      y,
      130,
      200,
      input.cabinetDepthMm,
      input.mountingDepthMm,
    );
    y += 220;
  }

  // ---- specification ------------------------------------------------------
  heading("Specification");
  if (product) {
    row("Product", `${product.manufacturers?.name ?? ""} ${product.series ?? ""} ${product.model}`.trim());
    row("Application", product.application === "outdoor" ? "Outdoor" : "Indoor");
    row("Pixel pitch", `${product.pixel_pitch_mm} mm`);
    row(
      "Diode",
      [product.diode_technology, product.diode_manufacturer, product.diode_package]
        .filter(Boolean)
        .join(" · ") || "Not specified",
    );
    row("Cabinet size", `${product.cabinet_width_mm} × ${product.cabinet_height_mm} mm`);
  }
  if (layout) {
    row("Cabinet grid", `${layout.columns} columns × ${layout.rows} rows (${layout.cabinets} cabinets)`);
    row(
      "Display size",
      `${formatNumber(layout.widthMm / 1000, 3)} m × ${formatNumber(layout.heightMm / 1000, 3)} m`,
    );
    row("Area", `${formatNumber(layout.areaSqm)} m²  /  ${formatNumber(layout.areaSqft)} ft²`);
    row("Resolution", `${layout.pixelWidth} × ${layout.pixelHeight} px`);
    row("Pixel density", `${formatNumber(layout.pixelsPerSqm, 0)} px / m²`);
    row("Aspect ratio", layout.aspectRatio);
    row("Weight", layout.weightKg != null ? `${formatNumber(layout.weightKg)} kg` : "Not specified");
    row(
      "Power (typical / max)",
      layout.powerTypicalW != null || layout.powerMaxW != null
        ? `${formatNumber(layout.powerTypicalW, 0)} W / ${formatNumber(layout.powerMaxW, 0)} W`
        : "Not specified",
    );
  }
  if (product) {
    row(
      "Power supply",
      [product.power_supply_brand, product.power_supply_qty ? `${product.power_supply_qty} per cabinet` : null]
        .filter(Boolean)
        .join(" · ") || "Not specified",
    );
  }
  row("Processor", processor ? `${processor.manufacturer_name ?? ""} ${processor.model} × ${input.processorQty}`.trim() : "Not specified");
  row("Receiver card", receiver ? `${receiver.manufacturer_name ?? ""} ${receiver.model}`.trim() : "Not specified");
  y += 6;

  // ---- pricing ------------------------------------------------------------
  heading(`Pricing (${cur}, excluding tax unless stated)`);
  ensure(20);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90, 100, 115);
  doc.text("Description", MARGIN, y);
  doc.text("Qty", MARGIN + 300, y, { align: "right" });
  doc.text("Amount", PAGE_W - MARGIN, y, { align: "right" });
  y += 12;
  doc.setDrawColor(220, 226, 234).line(MARGIN, y - 6, PAGE_W - MARGIN, y - 6);

  doc.setFont("helvetica", "normal").setTextColor(20, 24, 34);
  for (const line of totals.lines) {
    if (line.excluded) continue;
    ensure(16);
    const label =
      line.category === "freight" && line.freight_mode
        ? `${line.description} (${line.freight_mode} freight)`
        : line.description || CATEGORY_LABELS[line.category] || line.category;
    doc.text(label, MARGIN, y, { maxWidth: 280 });
    doc.text(formatNumber(line.quantity, 2), MARGIN + 300, y, { align: "right" });
    doc.text(formatMoney(line.sellingPrice, cur), PAGE_W - MARGIN, y, { align: "right" });
    y += 15;
  }

  y += 4;
  const totalRow = (label: string, value: string, bold = false) => {
    ensure(16);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, PAGE_W - MARGIN - 170, y, { align: "left" });
    doc.text(value, PAGE_W - MARGIN, y, { align: "right" });
    y += 15;
  };
  doc.setDrawColor(220, 226, 234).line(PAGE_W - MARGIN - 180, y - 8, PAGE_W - MARGIN, y - 8);
  totalRow("Subtotal", formatMoney(totals.subtotal, cur));
  totalRow(`Tax (${formatNumber(quote.tax_rate, 2)}%)`, formatMoney(totals.tax, cur));
  totalRow(`Total (${cur})`, formatMoney(totals.total, cur), true);

  y += 8;
  if (layout && totals.ledPerSqm != null) {
    heading("Rates");
    row("LED display selling rate", `${formatMoney(totals.ledPerSqm, cur)} / m²  ·  ${formatMoney(totals.ledPerSqft, cur)} / ft² (excl. tax)`);
    row(
      "Complete system selling rate",
      `${formatMoney(totals.systemPerSqm, cur)} / m²  ·  ${formatMoney(totals.systemPerSqft, cur)} / ft² (excl. tax)`,
    );
  }

  const freight = totals.lines.find((l) => l.category === "freight" && !l.excluded);
  heading("Terms");
  row("Freight", freight ? `${freight.freight_mode ?? "Not specified"} freight — ${freight.description}` : "Not specified");
  row("Payment terms", quote.payment_terms || "Not specified");
  row("Lead time", quote.lead_time || "Not specified");
  row("Warranty", quote.warranty || "Not specified");
  ensure(40);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90, 100, 115);
  doc.text("Exclusions", MARGIN, y);
  doc.setTextColor(20, 24, 34);
  const exclusions = doc.splitTextToSize(quote.exclusions || "Not specified", PAGE_W - MARGIN * 2 - 170);
  doc.text(exclusions, MARGIN + 170, y);
  y += exclusions.length * 12 + 10;

  footer(doc, quote);
  return doc.output("blob");
}

function footer(doc: jsPDF, quote: Quote) {
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150, 158, 170);
  doc.text(
    `${quote.quote_number} · Revision ${quote.revision} · All amounts in ${quote.currency}`,
    MARGIN,
    PAGE_H - 28,
  );
  doc.text(`Page ${doc.getNumberOfPages()}`, PAGE_W - MARGIN, PAGE_H - 28, { align: "right" });
}

function drawFrontElevation(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  layout: Layout,
  product: LedProduct,
) {
  const pad = 26;
  const scale = Math.min((w - pad * 2) / layout.widthMm, (h - pad * 2) / layout.heightMm);
  const dw = layout.widthMm * scale;
  const dh = layout.heightMm * scale;
  const x0 = x + pad;
  const y0 = y + pad;
  const cw = Number(product.cabinet_width_mm) * scale;
  const ch = Number(product.cabinet_height_mm) * scale;

  doc.setDrawColor(190, 200, 214).setLineWidth(0.4);
  for (let c = 0; c <= layout.columns; c++) doc.line(x0 + c * cw, y0, x0 + c * cw, y0 + dh);
  for (let r = 0; r <= layout.rows; r++) doc.line(x0, y0 + r * ch, x0 + dw, y0 + r * ch);
  doc.setDrawColor(30, 40, 55).setLineWidth(1).rect(x0, y0, dw, dh);

  doc.setFontSize(7).setTextColor(90, 100, 115);
  doc.line(x0, y0 - 8, x0 + dw, y0 - 8);
  doc.text(`${Math.round(layout.widthMm)} mm`, x0 + dw / 2, y0 - 11, { align: "center" });
  doc.line(x0 - 8, y0, x0 - 8, y0 + dh);
  doc.text(`${Math.round(layout.heightMm)} mm`, x0 - 11, y0 + dh / 2, {
    align: "center",
    angle: 90,
  });
  doc.text(
    `Front elevation — ${layout.columns} × ${layout.rows} cabinets`,
    x0,
    y0 + dh + 16,
  );
  doc.setLineWidth(0.2);
}

function drawSideProfile(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  cabinetDepthMm: number | null,
  mountingDepthMm: number | null,
) {
  const topY = y + 26;
  const boxH = h - 70;
  const cabW = cabinetDepthMm ? Math.min(34, Math.max(10, cabinetDepthMm / 4)) : 20;
  doc.setDrawColor(30, 40, 55).setLineWidth(0.8).rect(x + 20, topY, cabW, boxH);
  if (mountingDepthMm != null) {
    const mw = Math.min(30, Math.max(6, mountingDepthMm / 4));
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(x + 20 + cabW, topY + 12, mw, boxH - 24);
    doc.setLineDashPattern([], 0);
  }
  doc.setFontSize(7).setTextColor(90, 100, 115);
  doc.text("Side profile", x + 20, y + 16);
  doc.text(
    `Cabinet depth: ${cabinetDepthMm != null ? `${cabinetDepthMm} mm` : "Not specified"}`,
    x,
    topY + boxH + 16,
  );
  doc.text(
    `Mounting depth: ${mountingDepthMm != null ? `${mountingDepthMm} mm` : "Not specified"}`,
    x,
    topY + boxH + 28,
  );
  doc.text(
    `Total installed depth: ${
      cabinetDepthMm != null && mountingDepthMm != null
        ? `${cabinetDepthMm + mountingDepthMm} mm`
        : "Not specified"
    }`,
    x,
    topY + boxH + 40,
  );
  doc.setLineWidth(0.2);
}
