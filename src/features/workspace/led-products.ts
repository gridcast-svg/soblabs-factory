import { z } from "zod";
import { buildLayout, fitToWall, nearestLayouts } from "@/lib/led-calc";
import type { CabinetSpec } from "@/lib/led-calc";
const measurement = z.number().finite().positive().nullable().default(null);
const text = z.string().max(1000).default("");
export const safeProductUrl = z
  .string()
  .refine((s) => !s || /^https:\/\/[^\s]+$/i.test(s), "Use an HTTPS URL")
  .default("");
export const ledProductSchema = z.object({
  id: z.string().min(1),
  manufacturer: z.string().trim().min(1),
  series: text,
  model: z.string().trim().min(1),
  sku: text,
  kind: z.enum(["Cabinet", "All-in-one"]).default("Cabinet"),
  environment: z.enum(["Indoor", "Outdoor", "Not specified"]).default("Not specified"),
  widthMm: z.number().finite().positive().max(100000),
  heightMm: z.number().finite().positive().max(100000),
  pixelWidth: z.number().int().positive().max(100000),
  pixelHeight: z.number().int().positive().max(100000),
  depthMm: measurement,
  pixelPitchMm: measurement,
  brightnessNits: measurement,
  refreshHz: measurement,
  powerTypicalW: measurement,
  powerMaxW: measurement,
  weightKg: measurement,
  contrast: text,
  costPerSqm: z.number().finite().nonnegative().nullable().default(null),
  currency: z.enum(["CAD", "USD"]).default("CAD"),
  source: text,
  sourceText: z.string().max(80000).default(""),
  datasheetUrl: safeProductUrl,
  image: z
    .string()
    .max(300000)
    .refine(
      (s) => !s || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(s),
      "Use a PNG, JPEG or WebP product image",
    )
    .default(""),
  verifiedAt: z.string().default(""),
  demo: z.boolean().default(false),
});
export type LedLibraryProduct = z.infer<typeof ledProductSchema>;
export function cabinetSpec(p: LedLibraryProduct): CabinetSpec {
  return {
    widthMm: p.widthMm,
    heightMm: p.heightMm,
    depthMm: p.depthMm,
    pixelWidth: p.pixelWidth,
    pixelHeight: p.pixelHeight,
    weightKg: p.weightKg,
    powerTypicalW: p.powerTypicalW,
    powerMaxW: p.powerMaxW,
  };
}
export function productLayout(
  p: LedLibraryProduct,
  width: number,
  height: number,
  mode: "wall" | "desired",
  clearanceX = 0,
  clearanceY = 0,
) {
  const cab = cabinetSpec(p);
  if (p.kind === "All-in-one")
    return mode === "wall" &&
      (p.widthMm > width - clearanceX * 2 || p.heightMm > height - clearanceY * 2)
      ? null
      : buildLayout(cab, 1, 1);
  return mode === "wall"
    ? fitToWall(cab, width, height, clearanceX, clearanceY).layout
    : (nearestLayouts(cab, width, height, 1)[0]?.layout ?? null);
}
export function productIdentity(
  p: Pick<
    LedLibraryProduct,
    "manufacturer" | "model" | "sku" | "widthMm" | "heightMm" | "pixelWidth" | "pixelHeight"
  >,
) {
  return [
    p.manufacturer,
    p.model,
    p.sku,
    String(p.widthMm),
    String(p.heightMm),
    String(p.pixelWidth),
    String(p.pixelHeight),
  ]
    .map((s) => s.trim().toLowerCase())
    .join("|");
}
export function upsertLedProducts(existing: LedLibraryProduct[], incoming: LedLibraryProduct[]) {
  const validated = incoming.map((p) => ledProductSchema.parse(p));
  if (new Set(validated.map(productIdentity)).size !== validated.length)
    throw new Error("The upload contains duplicate product variants.");
  const result = [...existing];
  for (const p of validated) {
    const index = result.findIndex((old) => productIdentity(old) === productIdentity(p));
    if (index >= 0) result[index] = { ...p, id: result[index]!.id };
    else result.push(p);
  }
  if (result.length > 500)
    throw new Error("The workspace library supports up to 500 product variants.");
  return result;
}
export function pdfSpecDraft(sourceText: string, source: string): Record<string, unknown> {
  const draft: Record<string, unknown> = { source, sourceText };
  const numbers: [string, RegExp][] = [
    ["pixelPitchMm", /pixel\s*pitch\s*[:：]\s*(\d+(?:\.\d+)?)\s*mm\b/i],
    ["brightnessNits", /brightness\s*[:：]\s*(\d+(?:\.\d+)?)\s*(?:nits|cd\/m[²2])\b/i],
    ["refreshHz", /refresh\s*(?:rate)?\s*[:：]\s*(\d+(?:\.\d+)?)\s*hz\b/i],
    ["weightKg", /cabinet\s*weight\s*[:：]\s*(\d+(?:\.\d+)?)\s*kg\b/i],
  ];
  for (const [key, expression] of numbers) {
    const matches = [...sourceText.matchAll(new RegExp(expression.source, "gi"))];
    if (matches.length === 1) draft[key] = Number(matches[0]![1]);
  }
  const dimensions = [
    ...sourceText.matchAll(
      /cabinet\s*(?:dimensions|size)\s*[:：]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?\s*mm\b/gi,
    ),
  ];
  if (dimensions.length === 1) {
    draft["widthMm"] = Number(dimensions[0]![1]);
    draft["heightMm"] = Number(dimensions[0]![2]);
    if (dimensions[0]![3]) draft["depthMm"] = Number(dimensions[0]![3]);
  }
  const resolution = [
    ...sourceText.matchAll(
      /cabinet\s*(?:resolution|pixels)\s*[:：]\s*(\d+)\s*[x×]\s*(\d+)\s*(?:pixels|px)\b/gi,
    ),
  ];
  if (resolution.length === 1) {
    draft["pixelWidth"] = Number(resolution[0]![1]);
    draft["pixelHeight"] = Number(resolution[0]![2]);
  }
  return draft;
}
export const ledImportFields = [
  ["manufacturer", "Manufacturer"],
  ["series", "Series"],
  ["model", "Model"],
  ["sku", "SKU"],
  ["kind", "Product type"],
  ["environment", "Environment"],
  ["pixelPitchMm", "Pixel pitch (mm)"],
  ["widthMm", "Cabinet width (mm)"],
  ["heightMm", "Cabinet height (mm)"],
  ["depthMm", "Cabinet depth (mm)"],
  ["pixelWidth", "Cabinet pixels wide"],
  ["pixelHeight", "Cabinet pixels high"],
  ["brightnessNits", "Brightness (nits)"],
  ["refreshHz", "Refresh rate (Hz)"],
  ["powerTypicalW", "Typical power per cabinet (W)"],
  ["powerMaxW", "Maximum power per cabinet (W)"],
  ["weightKg", "Cabinet weight (kg)"],
  ["contrast", "Contrast ratio"],
  ["costPerSqm", "Supplier cost per m²"],
  ["currency", "Supplier currency"],
  ["datasheetUrl", "Datasheet URL"],
  ["source", "Specification source"],
] as const;
export async function readLedProducts(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Product uploads must be 5 MB or smaller.");
  let rows: Record<string, unknown>[];
  if (file.name.toLowerCase().endsWith(".json")) {
    const input = JSON.parse(await file.text());
    rows = z.array(z.record(z.unknown())).max(500).parse(input);
  } else {
    let table: unknown[][];
    if (file.name.toLowerCase().endsWith(".csv")) {
      const { parseDelimited } = await import("./crm-import");
      table = parseDelimited(await file.text());
    } else if (file.name.toLowerCase().endsWith(".xlsx")) {
      const { Workbook } = await import("exceljs");
      const wb = new Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.getWorksheet("LED Products") ?? wb.worksheets[0];
      if (!sheet) throw new Error("No product sheet found.");
      table = [];
      sheet.eachRow((row) => {
        table.push(Array.from({ length: sheet.columnCount }, (_, i) => row.getCell(i + 1).value));
      });
    } else throw new Error("Choose a PDF, CSV, XLSX or JSON specification file.");
    if (table.length < 2 || table.length > 501) throw new Error("Upload 1–500 product variants.");
    const normalize = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const headers = table[0]!.map(String);
    if (new Set(headers.map(normalize)).size !== headers.length)
      throw new Error("Duplicate column names in the upload.");
    const numeric = new Set([
      "pixelPitchMm",
      "widthMm",
      "heightMm",
      "depthMm",
      "pixelWidth",
      "pixelHeight",
      "brightnessNits",
      "refreshHz",
      "powerTypicalW",
      "powerMaxW",
      "weightKg",
      "costPerSqm",
    ]);
    rows = table.slice(1).map((row) => {
      const record: Record<string, unknown> = {};
      for (const [key, label] of ledImportFields) {
        const index = headers.findIndex(
          (h) => normalize(h) === normalize(key) || normalize(h) === normalize(label),
        );
        const value = index < 0 ? undefined : row[index];
        if (value === undefined || value === null || String(value).trim() === "") continue;
        if (typeof value === "object")
          throw new Error("Use plain values, not formulas or linked cells, in the product upload.");
        record[key] = numeric.has(key) ? Number(value) : String(value).trim();
      }
      return record;
    });
  }
  return rows.map((row, i) => {
    const parsed = ledProductSchema.safeParse({
      ...row,
      id: crypto.randomUUID(),
      source: row["source"] || file.name,
    });
    if (!parsed.success)
      throw new Error(
        `Row ${i + 1}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
      );
    return parsed.data;
  });
}
