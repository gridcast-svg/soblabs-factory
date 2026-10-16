/** Physical and pixel geometry of a cabinet array. */

export interface CabinetGeometry {
  /** Millimetres. */
  width: number;
  /** Millimetres. */
  height: number;
  resX: number;
  resY: number;
  /** Kilograms. */
  weight: number;
}

export interface Grid {
  cols: number;
  rows: number;
}

export interface ArrayGeometry extends Grid {
  totalCabinets: number;
  arrayWidthM: number;
  arrayHeightM: number;
  resX: number;
  resY: number;
  totalPixels: number;
  weightTotal: number;
}

const MM_PER_M = 1000;

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be greater than zero, got ${value}`);
  }
}

function requireWholeGrid({ cols, rows }: Grid): void {
  if (!Number.isInteger(cols) || cols < 1) {
    throw new RangeError(`cols must be a whole number of cabinets, got ${cols}`);
  }
  if (!Number.isInteger(rows) || rows < 1) {
    throw new RangeError(`rows must be a whole number of cabinets, got ${rows}`);
  }
}

/**
 * The smallest grid that covers the requested screen. A partial cabinet is
 * still a whole cabinet, so both axes round up.
 */
export function gridForDimensions({
  targetWidthM,
  targetHeightM,
  cabinet,
}: {
  targetWidthM: number;
  targetHeightM: number;
  cabinet: Pick<CabinetGeometry, "width" | "height">;
}): Grid {
  requirePositive(targetWidthM, "targetWidthM");
  requirePositive(targetHeightM, "targetHeightM");
  requirePositive(cabinet.width, "cabinet.width");
  requirePositive(cabinet.height, "cabinet.height");

  return {
    cols: Math.ceil(targetWidthM / (cabinet.width / MM_PER_M)),
    rows: Math.ceil(targetHeightM / (cabinet.height / MM_PER_M)),
  };
}

export function calculateArrayGeometry({
  cols,
  rows,
  cabinet,
}: Grid & { cabinet: CabinetGeometry }): ArrayGeometry {
  requireWholeGrid({ cols, rows });
  requirePositive(cabinet.width, "cabinet.width");
  requirePositive(cabinet.height, "cabinet.height");
  requirePositive(cabinet.resX, "cabinet.resX");
  requirePositive(cabinet.resY, "cabinet.resY");
  requirePositive(cabinet.weight, "cabinet.weight");

  const resX = cols * cabinet.resX;
  const resY = rows * cabinet.resY;

  return {
    cols,
    rows,
    totalCabinets: cols * rows,
    arrayWidthM: (cols * cabinet.width) / MM_PER_M,
    arrayHeightM: (rows * cabinet.height) / MM_PER_M,
    resX,
    resY,
    totalPixels: resX * resY,
    weightTotal: cols * rows * cabinet.weight,
  };
}

/**
 * How many cabinets one processor port can drive. A port carries a fixed pixel
 * budget, and a cabinet is indivisible, so the budget rounds down.
 */
export function cabinetsPerDataPort({
  maxPixelsPerPort,
  cabinet,
}: {
  maxPixelsPerPort: number;
  cabinet: Pick<CabinetGeometry, "resX" | "resY">;
}): number {
  requirePositive(maxPixelsPerPort, "maxPixelsPerPort");
  requirePositive(cabinet.resX, "cabinet.resX");
  requirePositive(cabinet.resY, "cabinet.resY");

  const pixelsPerCabinet = cabinet.resX * cabinet.resY;
  return Math.max(1, Math.floor(maxPixelsPerPort / pixelsPerCabinet));
}
