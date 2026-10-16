/** Electrical load and power distribution for a cabinet array. */

/**
 * A screen is a continuous load, so a breaker is only planned to 80% of its
 * rating. The cable's own connector rating still applies on top of that.
 */
export const BREAKER_DERATING = 0.8;

export interface CircuitLimits {
  /** Rating of the breaker feeding one line, in amps. */
  breakerAmps: number;
  /** Rating of the connector/cable loop, in amps. */
  cableLoopAmps: number;
}

/**
 * How hard the screen is actually being driven.
 *
 * Circuits are never sized from this — see `cabinetsPerPowerCircuit`, which
 * divides by the peak. A white frame is not hypothetical (a walk-in slide, a
 * logo card, a cut to a brightly lit stage on IMAG) and a breaker planned
 * around typical content trips on the first one. This exists to answer a
 * different question: what to ask the venue or the generator for.
 */
export const CONTENT_LEVELS = ["dark", "video", "bright", "white"] as const;

export type ContentLevel = (typeof CONTENT_LEVELS)[number];

/**
 * Multiplier on the cabinet's own typical figure at full brightness. `video` is
 * 1 because the catalog's `avgPower` already *is* the manufacturer's typical
 * content; the others are named steps either side of it. `white` ignores the
 * multiplier and takes the peak, which is what all-white means.
 */
const CONTENT_FACTORS: Record<Exclude<ContentLevel, "white">, number> = {
  dark: 0.6,
  video: 1,
  bright: 1.8,
};

export interface ExpectedPowerInput {
  totalCabinets: number;
  cabinetMaxPowerW: number;
  cabinetAvgPowerW: number;
  /** Screen brightness as a fraction, above 0 and up to 1. */
  brightness: number;
  content: ContentLevel;
}

/**
 * What the array is likely to pull as run, rather than at its ceiling.
 *
 * Deliberately NOT modelled: the fixed overhead that does not dim — receiving
 * cards, fans, driver quiescent draw. There is no figure for it in the catalog,
 * and inventing one would put a number nobody measured into an electrical
 * estimate. The consequence is that this reads low at low brightness, which is
 * why it is a planning figure and never a circuit.
 */
export function expectedPowerW({
  totalCabinets,
  cabinetMaxPowerW,
  cabinetAvgPowerW,
  brightness,
  content,
}: ExpectedPowerInput): number {
  if (!Number.isInteger(totalCabinets) || totalCabinets < 0) {
    throw new RangeError(`totalCabinets must be zero or more, got ${totalCabinets}`);
  }
  requirePositive(cabinetMaxPowerW, "cabinetMaxPowerW");
  requirePositive(cabinetAvgPowerW, "cabinetAvgPowerW");
  if (!Number.isFinite(brightness) || brightness <= 0 || brightness > 1) {
    throw new RangeError(`brightness must be above 0 and at most 1, got ${brightness}`);
  }

  const atFullBrightness =
    content === "white" ? cabinetMaxPowerW : cabinetAvgPowerW * CONTENT_FACTORS[content];

  // No content and no setting can draw more than the panels physically can.
  const perCabinet = Math.min(cabinetMaxPowerW, atFullBrightness * brightness);
  return totalCabinets * perCabinet;
}

export interface ElectricalInput extends CircuitLimits {
  totalCabinets: number;
  cabinetMaxPowerW: number;
  cabinetAvgPowerW: number;
  voltage: number;
  /** How the screen is actually driven. Never used to size a circuit. */
  brightness: number;
  content: ContentLevel;
}

export interface ElectricalLoad {
  /** All white at full brightness. Everything protective is sized on this. */
  maxPowerW: number;
  avgPowerW: number;
  maxAmps: number;
  /** What the screen is likely to pull as it is actually being run. */
  expectedPowerW: number;
  expectedAmps: number;
  ampsPerLine: number;
  cabinetsPerPowerCable: number;
}

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be greater than zero, got ${value}`);
  }
}

/** The real current ceiling for one line: the stricter of breaker and cable. */
export function effectiveAmpsPerLine({ breakerAmps, cableLoopAmps }: CircuitLimits): number {
  requirePositive(breakerAmps, "breakerAmps");
  requirePositive(cableLoopAmps, "cableLoopAmps");

  return Math.min(breakerAmps * BREAKER_DERATING, cableLoopAmps);
}

/**
 * How many cabinets one power circuit can carry at their peak draw. Always at
 * least one: a panel that outdraws a whole circuit still needs its own cable.
 */
export function cabinetsPerPowerCircuit({
  voltage,
  ampsPerLine,
  cabinetMaxPowerW,
}: {
  voltage: number;
  ampsPerLine: number;
  cabinetMaxPowerW: number;
}): number {
  requirePositive(voltage, "voltage");
  requirePositive(ampsPerLine, "ampsPerLine");
  requirePositive(cabinetMaxPowerW, "cabinetMaxPowerW");

  return Math.max(1, Math.floor((voltage * ampsPerLine) / cabinetMaxPowerW));
}

export function calculateElectricalLoad(input: ElectricalInput): ElectricalLoad {
  const { totalCabinets, cabinetMaxPowerW, cabinetAvgPowerW, voltage } = input;

  if (!Number.isInteger(totalCabinets) || totalCabinets < 0) {
    throw new RangeError(`totalCabinets must be zero or more, got ${totalCabinets}`);
  }
  requirePositive(voltage, "voltage");
  requirePositive(cabinetMaxPowerW, "cabinetMaxPowerW");
  requirePositive(cabinetAvgPowerW, "cabinetAvgPowerW");

  const ampsPerLine = effectiveAmpsPerLine(input);
  const cabinetsPerPowerCable = cabinetsPerPowerCircuit({
    voltage,
    ampsPerLine,
    cabinetMaxPowerW,
  });
  const maxPowerW = totalCabinets * cabinetMaxPowerW;
  const expected = expectedPowerW({
    totalCabinets,
    cabinetMaxPowerW,
    cabinetAvgPowerW,
    brightness: input.brightness,
    content: input.content,
  });

  return {
    maxPowerW,
    avgPowerW: totalCabinets * cabinetAvgPowerW,
    maxAmps: maxPowerW / voltage,
    expectedPowerW: expected,
    expectedAmps: expected / voltage,
    ampsPerLine,
    cabinetsPerPowerCable,
  };
}
