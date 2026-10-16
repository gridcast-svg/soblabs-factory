/**
 * What the drawn plan actually costs in cables and processors.
 *
 * This used to be `Math.ceil(totalCabinets / capacity)`, computed beside the
 * routing rather than from it. That division assumes a cable can be cut
 * anywhere, and a cable cannot: a run takes whole columns so its main reaches
 * the floor, which regularly needs one more cable than the arithmetic minimum.
 * The report was printing "3 main data cables" over a schematic that drew four.
 *
 * The crew loads what the drawing shows, so the drawing is the number that
 * ships. Counting the runs is the only way the two cannot disagree.
 */

import type { GridPosition } from "./serpentine";

export type ProcessorLimit = "ports" | "pixels" | "canvas";

export interface RoutingDemand {
  dataCables: number;
  powerCables: number;
  processorsNeeded: number;
  /**
   * Which ceiling forced a second controller, and so what to do about it. Null
   * whenever one box is enough: with nothing exceeded there is nothing to name,
   * and naming one anyway told a technician their plan was over a limit it was
   * comfortably inside.
   */
  processorLimit: ProcessorLimit | null;
}

export interface RoutingDemandInput {
  dataRuns: GridPosition[][];
  powerRuns: GridPosition[][];
  /** Data ports on one sending box. */
  dataPortsPerProcessor: number;
  totalPixels: number;
  /**
   * What the whole controller carries, which is not its ports multiplied by
   * what a port carries. An MCTRL4K has sixteen gigabit ports moving 650 k
   * pixels each — 10.4 M — and drives 8.8 M. Counting ports alone says one box
   * is enough for a screen it cannot drive.
   */
  maxPixelsPerProcessor: number;
  resX: number;
  resY: number;
  /**
   * The canvas one controller can address.
   *
   * A third ceiling, and the one that no amount of spare capacity fixes: a
   * VX1000 reaches 10,240 px across whatever else is free, so a wider screen
   * has to be split between controllers even if it has few pixels.
   */
  maxCanvasWidth: number;
  maxCanvasHeight: number;
}

/** A half-drawn manual plan carries a trailing empty run; it is not a cable. */
const countCables = (runs: GridPosition[][]): number =>
  runs.reduce((total, run) => total + (run.length > 0 ? 1 : 0), 0);

export function routingDemand({
  dataRuns,
  powerRuns,
  dataPortsPerProcessor,
  totalPixels,
  maxPixelsPerProcessor,
  resX,
  resY,
  maxCanvasWidth,
  maxCanvasHeight,
}: RoutingDemandInput): RoutingDemand {
  if (!Number.isInteger(dataPortsPerProcessor) || dataPortsPerProcessor < 1) {
    throw new RangeError(
      `a processor must have at least one data port, got ${dataPortsPerProcessor}`,
    );
  }
  if (!Number.isFinite(maxPixelsPerProcessor) || maxPixelsPerProcessor <= 0) {
    throw new RangeError(`a processor must carry some pixels, got ${maxPixelsPerProcessor}`);
  }

  const dataCables = countCables(dataRuns);

  // Three ceilings, and the fix is different for each: more ports means another
  // box, more pixels means another box, and a canvas too wide means splitting
  // the screen between boxes.
  const byPorts = Math.ceil(dataCables / dataPortsPerProcessor);
  const byPixels = Math.ceil(totalPixels / maxPixelsPerProcessor);
  // No screen is no canvas: a grid of zero needs no controller to address it.
  const byCanvas =
    resX > 0 && resY > 0 ? Math.ceil(resX / maxCanvasWidth) * Math.ceil(resY / maxCanvasHeight) : 0;

  const processorsNeeded = Math.max(byPorts, byPixels, byCanvas);
  const processorLimit: ProcessorLimit | null =
    processorsNeeded <= 1
      ? null
      : processorsNeeded === byCanvas
        ? "canvas"
        : processorsNeeded === byPixels
          ? "pixels"
          : "ports";

  return {
    dataCables,
    powerCables: countCables(powerRuns),
    processorsNeeded,
    processorLimit,
  };
}
