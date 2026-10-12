/**
 * Soblabs LED Configurator — sizing, geometry and pricing engine.
 * Internal unit for all length maths is the millimetre.
 * Monetary maths is done in integer cents to stay decimal-safe.
 */

export const SQM_TO_SQFT = 10.7639104167;

export type LengthUnit = "m" | "mm" | "ft";

export function toMm(value: number, unit: LengthUnit): number {
  if (!Number.isFinite(value)) return 0;
  switch (unit) {
    case "m":
      return value * 1000;
    case "ft":
      return value * 304.8;
    default:
      return value;
  }
}

export function fromMm(mm: number, unit: LengthUnit): number {
  switch (unit) {
    case "m":
      return mm / 1000;
    case "ft":
      return mm / 304.8;
    default:
      return mm;
  }
}

export function feetInchesLabel(mm: number): string {
  const totalInches = mm / 25.4;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return `${feet}' ${inches.toFixed(1)}"`;
}

export type CabinetSpec = {
  widthMm: number;
  heightMm: number;
  depthMm: number | null;
  pixelWidth: number;
  pixelHeight: number;
  weightKg: number | null;
  powerTypicalW: number | null;
  powerMaxW: number | null;
};

export type Layout = {
  columns: number;
  rows: number;
  cabinets: number;
  widthMm: number;
  heightMm: number;
  areaSqm: number;
  areaSqft: number;
  diagonalMm: number;
  aspectRatio: string;
  pixelWidth: number;
  pixelHeight: number;
  totalPixels: number;
  pixelsPerSqm: number | null;
  weightKg: number | null;
  powerTypicalW: number | null;
  powerMaxW: number | null;
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function buildLayout(cab: CabinetSpec, columns: number, rows: number): Layout {
  const cols = Math.max(0, Math.floor(columns));
  const rws = Math.max(0, Math.floor(rows));
  const widthMm = cols * cab.widthMm;
  const heightMm = rws * cab.heightMm;
  const areaSqm = (widthMm / 1000) * (heightMm / 1000);
  const pixelWidth = cols * cab.pixelWidth;
  const pixelHeight = rws * cab.pixelHeight;
  const totalPixels = pixelWidth * pixelHeight;
  const g = pixelWidth && pixelHeight ? gcd(pixelWidth, pixelHeight) : 1;
  const cabinets = cols * rws;
  return {
    columns: cols,
    rows: rws,
    cabinets,
    widthMm,
    heightMm,
    areaSqm,
    areaSqft: areaSqm * SQM_TO_SQFT,
    diagonalMm: Math.sqrt(widthMm * widthMm + heightMm * heightMm),
    aspectRatio: pixelWidth && pixelHeight ? `${pixelWidth / g}:${pixelHeight / g}` : "—",
    pixelWidth,
    pixelHeight,
    totalPixels,
    pixelsPerSqm: areaSqm > 0 ? totalPixels / areaSqm : null,
    weightKg: cab.weightKg == null ? null : cab.weightKg * cabinets,
    powerTypicalW: cab.powerTypicalW == null ? null : cab.powerTypicalW * cabinets,
    powerMaxW: cab.powerMaxW == null ? null : cab.powerMaxW * cabinets,
  };
}

/** Wall-fit: largest whole-cabinet grid that never exceeds the usable space. */
export function fitToWall(
  cab: CabinetSpec,
  wallWidthMm: number,
  wallHeightMm: number,
  clearanceXMm = 0,
  clearanceYMm = 0,
): { layout: Layout | null; usableWidthMm: number; usableHeightMm: number; message?: string } {
  const usableWidthMm = Math.max(0, wallWidthMm - clearanceXMm * 2);
  const usableHeightMm = Math.max(0, wallHeightMm - clearanceYMm * 2);
  const cols = Math.floor(usableWidthMm / cab.widthMm);
  const rows = Math.floor(usableHeightMm / cab.heightMm);
  if (cols < 1 || rows < 1) {
    const reasons: string[] = [];
    if (cols < 1)
      reasons.push(
        `usable width ${usableWidthMm.toFixed(0)} mm is smaller than one cabinet (${cab.widthMm} mm)`,
      );
    if (rows < 1)
      reasons.push(
        `usable height ${usableHeightMm.toFixed(0)} mm is smaller than one cabinet (${cab.heightMm} mm)`,
      );
    return {
      layout: null,
      usableWidthMm,
      usableHeightMm,
      message: `Not even one cabinet fits: ${reasons.join(" and ")}.`,
    };
  }
  return { layout: buildLayout(cab, cols, rows), usableWidthMm, usableHeightMm };
}

export type LayoutOption = {
  layout: Layout;
  widthDeltaMm: number;
  heightDeltaMm: number;
  deviation: number;
};

/** Desired-size: rank nearby whole-cabinet layouts by combined proportional deviation. */
export function nearestLayouts(
  cab: CabinetSpec,
  targetWidthMm: number,
  targetHeightMm: number,
  count = 5,
): LayoutOption[] {
  if (targetWidthMm <= 0 || targetHeightMm <= 0) return [];
  const baseCols = Math.max(1, Math.round(targetWidthMm / cab.widthMm));
  const baseRows = Math.max(1, Math.round(targetHeightMm / cab.heightMm));
  const options: LayoutOption[] = [];
  for (let c = Math.max(1, baseCols - 2); c <= baseCols + 2; c++) {
    for (let r = Math.max(1, baseRows - 2); r <= baseRows + 2; r++) {
      const layout = buildLayout(cab, c, r);
      const widthDeltaMm = layout.widthMm - targetWidthMm;
      const heightDeltaMm = layout.heightMm - targetHeightMm;
      const deviation =
        Math.abs(widthDeltaMm) / targetWidthMm + Math.abs(heightDeltaMm) / targetHeightMm;
      options.push({ layout, widthDeltaMm, heightDeltaMm, deviation });
    }
  }
  options.sort((a, b) => {
    if (Math.abs(a.deviation - b.deviation) > 1e-9) return a.deviation - b.deviation;
    return a.layout.areaSqm - b.layout.areaSqm; // smaller area breaks ties
  });
  return options.slice(0, count);
}

/* ------------------------------- money ---------------------------------- */

export type Currency = "USD" | "CAD";

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Convert an amount between USD and CAD using an explicit "1 USD = rate CAD". */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  usdToCad: number | null,
): number {
  if (from === to) return round2(amount);
  if (!usdToCad || usdToCad <= 0) throw new Error("A valid exchange rate (1 USD = X CAD) is required.");
  return round2(from === "USD" ? amount * usdToCad : amount / usdToCad);
}

export function markupToMargin(markupPct: number): number {
  return round2((markupPct / (100 + markupPct)) * 100);
}

export function marginToMarkup(marginPct: number): number {
  if (marginPct >= 100) throw new Error("Margin must be below 100%.");
  return round2((marginPct / (100 - marginPct)) * 100);
}

export function sellFromMarkup(cost: number, markupPct: number): number {
  return round2(cost * (1 + markupPct / 100));
}

export function sellFromMargin(cost: number, marginPct: number): number {
  if (marginPct >= 100) throw new Error("Margin must be below 100%.");
  return round2(cost / (1 - marginPct / 100));
}

export type PricingMode = "markup" | "margin";

export type LineItemInput = {
  id?: string;
  category: string;
  description: string;
  quantity: number;
  unit_cost: number;
  cost_currency: Currency;
  taxable: boolean;
  markup_override: number | null;
  margin_override: number | null;
  included_in_led: boolean;
  freight_mode?: string | null;
  sort_order?: number;
};

export type PricedLine = LineItemInput & {
  costInQuoteCurrency: number;
  sellingPrice: number;
  profit: number;
  effectiveMarkup: number;
  effectiveMargin: number;
  excluded: boolean;
};

export type QuoteTotals = {
  lines: PricedLine[];
  totalCost: number;
  subtotal: number;
  taxableSubtotal: number;
  tax: number;
  total: number;
  grossProfit: number;
  markupPct: number;
  marginPct: number;
  ledSelling: number;
  ledPerSqm: number | null;
  ledPerSqft: number | null;
  systemPerSqm: number | null;
  systemPerSqft: number | null;
};

export function priceQuote(params: {
  items: LineItemInput[];
  quoteCurrency: Currency;
  usdToCad: number | null;
  mode: PricingMode;
  markupPct: number;
  marginPct: number;
  taxRate: number;
  areaSqm: number | null;
}): QuoteTotals {
  const { items, quoteCurrency, usdToCad, mode, markupPct, marginPct, taxRate, areaSqm } = params;

  const lines: PricedLine[] = items.map((item) => {
    // Components bundled into the LED price are never charged again.
    const excluded = item.included_in_led;
    const rawCost = excluded ? 0 : round2(item.quantity * item.unit_cost);
    const costInQuoteCurrency = convert(rawCost, item.cost_currency, quoteCurrency, usdToCad);

    let sellingPrice: number;
    if (item.markup_override != null) {
      sellingPrice = sellFromMarkup(costInQuoteCurrency, item.markup_override);
    } else if (item.margin_override != null) {
      sellingPrice = sellFromMargin(costInQuoteCurrency, item.margin_override);
    } else {
      sellingPrice =
        mode === "markup"
          ? sellFromMarkup(costInQuoteCurrency, markupPct)
          : sellFromMargin(costInQuoteCurrency, marginPct);
    }

    const profit = round2(sellingPrice - costInQuoteCurrency);
    return {
      ...item,
      costInQuoteCurrency,
      sellingPrice,
      profit,
      effectiveMarkup: costInQuoteCurrency > 0 ? round2((profit / costInQuoteCurrency) * 100) : 0,
      effectiveMargin: sellingPrice > 0 ? round2((profit / sellingPrice) * 100) : 0,
      excluded,
    };
  });

  const totalCost = round2(lines.reduce((sum, l) => sum + l.costInQuoteCurrency, 0));
  const subtotal = round2(lines.reduce((sum, l) => sum + l.sellingPrice, 0));
  const taxableSubtotal = round2(
    lines.filter((l) => l.taxable).reduce((sum, l) => sum + l.sellingPrice, 0),
  );
  const tax = round2(taxableSubtotal * (taxRate / 100));
  const grossProfit = round2(subtotal - totalCost);
  const ledSelling = round2(
    lines.filter((l) => l.category === "led").reduce((sum, l) => sum + l.sellingPrice, 0),
  );

  return {
    lines,
    totalCost,
    subtotal,
    taxableSubtotal,
    tax,
    total: round2(subtotal + tax),
    grossProfit,
    markupPct: totalCost > 0 ? round2((grossProfit / totalCost) * 100) : 0,
    marginPct: subtotal > 0 ? round2((grossProfit / subtotal) * 100) : 0,
    ledSelling,
    ledPerSqm: areaSqm && areaSqm > 0 ? round2(ledSelling / areaSqm) : null,
    ledPerSqft: areaSqm && areaSqm > 0 ? round2(ledSelling / (areaSqm * SQM_TO_SQFT)) : null,
    systemPerSqm: areaSqm && areaSqm > 0 ? round2(subtotal / areaSqm) : null,
    systemPerSqft: areaSqm && areaSqm > 0 ? round2(subtotal / (areaSqm * SQM_TO_SQFT)) : null,
  };
}

export function formatMoney(value: number | null | undefined, currency: Currency | string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "USD",
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "Not specified";
  return new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function orNotSpecified(value: unknown, suffix = ""): string {
  if (value === null || value === undefined || value === "") return "Not specified";
  return `${value}${suffix}`;
}
