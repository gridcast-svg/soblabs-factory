import { blankItem, uid } from "./model";
import type { BomItem, Project } from "./model";
export function download(name: string, data: Blob | string, type = "application/json") {
  const url = URL.createObjectURL(typeof data === "string" ? new Blob([data], { type }) : data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const MAX = 15 * 1024 * 1024;
export function checkFile(file: File, extension: string) {
  if (!file.name.toLowerCase().endsWith(extension)) throw new Error(`Choose a ${extension} file.`);
  if (file.size > MAX) throw new Error("Files must be smaller than 15 MB.");
}
export async function readPdf(file: File) {
  checkFile(file, ".pdf");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > 100) throw new Error("Use a PDF with 100 pages or fewer.");
    let text = "";
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      text +=
        content.items
          .map((i) => ("str" in i ? i.str + ("hasEOL" in i && i.hasEOL ? "\n" : " ") : ""))
          .join("") + "\n";
    }
    if (!text.trim())
      throw new Error(
        "This PDF has no readable text. Export a text PDF from PLAUD; OCR is not available yet.",
      );
    return text;
  } finally {
    await task.destroy();
  }
}
export type ImportResult = { items: BomItem[]; warnings: string[]; sourceSheets: string[] };
export async function readBom(file: File): Promise<ImportResult> {
  checkFile(file, ".xlsx");
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const items: BomItem[] = [];
  const warnings: string[] = [];
  const sourceSheets: string[] = [];
  function text(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "object") {
      const o = v as { result?: unknown; richText?: { text: string }[] };
      return o.richText
        ? o.richText.map((x) => x.text).join("")
        : o.result !== undefined
          ? text(o.result)
          : "";
    }
    return String(v).trim();
  }
  function numeric(v: unknown): number | null {
    const raw = text(v);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const modern = wb.getWorksheet("BOM Items");
  if (modern) {
    const expected = [
      "Item ID",
      "Area / System",
      "Scope",
      "Category",
      "Manufacturer",
      "Manufacturer Part No",
      "Description",
      "Supplier",
      "Supplier SKU",
      "Quantity",
      "Unit",
      "Unit Cost",
      "Cost Currency",
      "FX to Project Currency",
      "Markup %",
      "Taxable",
    ];
    expected.forEach((h, i) => {
      if (text(modern.getRow(1).getCell(i + 1).value) !== h)
        throw new Error(`Unexpected column ${i + 1}; use the Soblabs template.`);
    });
    sourceSheets.push(modern.name);
    modern.eachRow((row, r) => {
      if (r === 1 || !text(row.getCell(7).value)) return;
      const c = (n: number) => row.getCell(n).value;
      const base = blankItem();
      const scope = text(c(3));
      const currency = text(c(13));
      const qty = numeric(c(10));
      const markup = numeric(c(15));
      const fx = numeric(c(14));
      const cost = numeric(c(12));
      const taxable = text(c(16));
      if (
        !["Selected", "Alternative", "Excluded"].includes(scope) ||
        !["CAD", "USD"].includes(currency) ||
        qty === null ||
        qty < 0 ||
        markup === null ||
        markup < 0 ||
        fx === null ||
        fx <= 0 ||
        (cost !== null && cost < 0) ||
        !["Yes", "No"].includes(taxable)
      )
        throw new Error(
          `Row ${r}: check scope, currency, quantity, cost, FX, markup, and taxable status.`,
        );
      items.push({
        ...base,
        id: text(c(1)) || uid(),
        area: text(c(2)),
        scope: scope as BomItem["scope"],
        category: text(c(4)),
        manufacturer: text(c(5)),
        partNumber: text(c(6)),
        description: text(c(7)),
        supplier: text(c(8)),
        sku: text(c(9)),
        quantity: qty,
        unit: text(c(11)) || "ea",
        unitCost: cost,
        currency: currency as "CAD" | "USD",
        fx,
        markup: markup * 100,
        taxable: taxable === "Yes",
        leadDays: numeric(c(17)),
        notes: text(c(18)),
        drawingRequired: !["Labour", "Freight", "Spares"].includes(text(c(4))),
      });
    });
  } else {
    wb.eachSheet((sheet) => {
      if (
        text(sheet.getCell("D4").value) !== "QUANTITY" ||
        text(sheet.getCell("F4").value) !== "UNIT COST"
      )
        return;
      sourceSheets.push(sheet.name);
      sheet.eachRow((row, r) => {
        if (r < 5) return;
        const qty = numeric(row.getCell(4).value);
        const description = text(row.getCell(5).value);
        if (qty === null || !description) return;
        const unitCost = numeric(row.getCell(6).value);
        const markup = numeric(row.getCell(8).value);
        if (qty < 0 || (unitCost !== null && unitCost < 0))
          throw new Error(`${sheet.name} row ${r}: negative quantity or cost.`);
        const base = blankItem();
        const service = /install|shipping|handling|fee/i.test(description);
        items.push({
          ...base,
          area: sheet.name,
          scope: "Alternative",
          description,
          quantity: qty,
          unit: service ? "verify" : "ea",
          unitCost,
          fx: null,
          markup: (markup ?? 0) * 100,
          drawingRequired: !service,
          notes:
            "Legacy import: verify selection, currency, quantity unit, tax and FX before approval.",
        });
      });
    });
    warnings.push(
      "Legacy rows are imported as alternatives. Select the intended rooms/options and verify currency, tax, FX, and labour units. Summary and subtotal rows were not imported. Legacy imports create new item IDs; export the standardized workbook before using it for subsequent revisions.",
    );
  }
  if (!items.length)
    throw new Error(
      "No BOM items found. Use the Soblabs template or the supplied legacy proposal format.",
    );
  if (items.length > 2000) throw new Error("Import at most 2,000 items at a time.");
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw new Error("Duplicate Item IDs in workbook. Give each row a unique ID.");
  return { items, warnings, sourceSheets };
}
export function mergeItems(existing: BomItem[], incoming: BomItem[]) {
  const map = new Map(existing.map((i) => [i.id, i]));
  for (const i of incoming) {
    const old = map.get(i.id);
    map.set(
      i.id,
      old ? { ...i, ports: old.ports, rackU: old.rackU, drawingRequired: old.drawingRequired } : i,
    );
  }
  return [...map.values()];
}
export async function exportBom(p: Project) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const meta = wb.addWorksheet("Project");
  meta.addRows([
    ["Field", "Value"],
    ["Project ID", p.id],
    ["Project Name", p.name],
    ["Customer", p.customer],
    ["Revision", p.revision],
    ["Project Currency", p.currency],
    ["Tax Rate", p.taxRate / 100],
  ]);
  const s = wb.addWorksheet("BOM Items");
  s.addRow([
    "Item ID",
    "Area / System",
    "Scope",
    "Category",
    "Manufacturer",
    "Manufacturer Part No",
    "Description",
    "Supplier",
    "Supplier SKU",
    "Quantity",
    "Unit",
    "Unit Cost",
    "Cost Currency",
    "FX to Project Currency",
    "Markup %",
    "Taxable",
    "Lead Time Days",
    "Notes",
  ]);
  p.items.forEach((i) =>
    s.addRow([
      i.id,
      i.area,
      i.scope,
      i.category,
      i.manufacturer,
      i.partNumber,
      i.description,
      i.supplier,
      i.sku,
      i.quantity,
      i.unit,
      i.unitCost,
      i.currency,
      i.fx,
      i.markup / 100,
      i.taxable ? "Yes" : "No",
      i.leadDays,
      i.notes,
    ]),
  );
  s.getColumn(15).numFmt = "0.00%";
  [6, 9].forEach((n) => (s.getColumn(n).numFmt = "@"));
  s.columns.forEach((c) => (c.width = 24));
  s.getColumn(7).width = 50;
  s.views = [{ state: "frozen", ySplit: 1 }];
  s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  s.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173A4A" } };
  const buf = await wb.xlsx.writeBuffer();
  download(
    `${p.name.replace(/[^\w -]/g, "")}-BOM-r${p.revision}.xlsx`,
    new Blob([buf as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}
