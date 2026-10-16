/**
 * Cable routing over a cabinet grid.
 *
 * A run of cabinets is daisy-chained from one port, so the route has to walk
 * neighbour to neighbour: a serpentine. This module is the single source for
 * that walk — the on-screen schematic and the exported PDF both read from here.
 */

export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

export type RoutingPriority = "vertical" | "horizontal";

export const START_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

export type StartCorner = (typeof START_CORNERS)[number];

export interface GridLayout {
  cols: number;
  rows: number;
  priority: RoutingPriority;
  start: StartCorner;
}

/**
 * Where each cable's chain is allowed to begin.
 *
 * `continuous` walks one snake over the whole grid and slices it by capacity.
 * The slice knows nothing about geometry, so a run can begin halfway up the
 * screen or at the very top — and whether it does is an accident of whether the
 * balanced run length happens to divide by the row count. On an 8x5 grid at 11
 * per cable it comes out right; on 4x5 at 7 it does not.
 *
 * `start-edge` makes each run its own serpentine, aligned to whole columns (or
 * whole rows) so every chain begins on the start corner's edge. The processor
 * and the PDU sit on the ground, so a main that drops to the floor is the one
 * a crew can actually pull. It costs more mains, which is the trade.
 */
export const MAINS_POLICIES = ["start-edge", "continuous"] as const;

export type MainsPolicy = (typeof MAINS_POLICIES)[number];

export interface RoutePlan extends GridLayout {
  /** Maximum cabinets one cable may carry. */
  capacity: number;
  /** Defaults to `start-edge`. */
  mains?: MainsPolicy;
}

function requireGridSize(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a whole number of cabinets, got ${value}`);
  }
}

/**
 * The order a single cable would visit every cabinet in the grid, snaking so
 * that consecutive cabinets are always physically adjacent.
 */
export function serpentineSequence({ cols, rows, priority, start }: GridLayout): GridPosition[] {
  requireGridSize(cols, "cols");
  requireGridSize(rows, "rows");

  const fromRight = start.includes("right");
  const fromBottom = start.includes("bottom");
  const sequence: GridPosition[] = [];

  if (priority === "vertical") {
    const firstX = fromRight ? cols - 1 : 0;
    const stepX = fromRight ? -1 : 1;

    for (let c = 0; c < cols; c++) {
      const goingWithStart = c % 2 === 0;
      const firstY = goingWithStart ? (fromBottom ? rows - 1 : 0) : fromBottom ? 0 : rows - 1;
      const stepY = goingWithStart === fromBottom ? -1 : 1;

      for (let r = 0; r < rows; r++) {
        sequence.push({ x: firstX + c * stepX, y: firstY + r * stepY });
      }
    }
    return sequence;
  }

  const firstY = fromBottom ? rows - 1 : 0;
  const stepY = fromBottom ? -1 : 1;

  for (let r = 0; r < rows; r++) {
    const goingWithStart = r % 2 === 0;
    const firstX = goingWithStart ? (fromRight ? cols - 1 : 0) : fromRight ? 0 : cols - 1;
    const stepX = goingWithStart === fromRight ? -1 : 1;

    for (let c = 0; c < cols; c++) {
      sequence.push({ x: firstX + c * stepX, y: firstY + r * stepY });
    }
  }
  return sequence;
}

/**
 * Split a sequence across as few cables as capacity allows, then even the runs
 * out. Forty cabinets at eleven per cable become four runs of ten rather than
 * three of eleven and a stub of seven — an even load is easier to build and
 * leaves headroom on every line.
 */
export function balanceIntoRuns(sequence: GridPosition[], capacity: number): GridPosition[][] {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`capacity must be at least one cabinet, got ${capacity}`);
  }
  if (sequence.length === 0) return [];

  const runCount = Math.ceil(sequence.length / capacity);
  const baseLength = Math.floor(sequence.length / runCount);
  const remainder = sequence.length % runCount;

  const runs: GridPosition[][] = [];
  let cursor = 0;
  for (let i = 0; i < runCount; i++) {
    const length = baseLength + (i < remainder ? 1 : 0);
    runs.push(sequence.slice(cursor, cursor + length));
    cursor += length;
  }
  return runs;
}

/** Split `count` items into `groups` as evenly as possible, biggest first. */
function evenGroupSizes(count: number, groups: number): number[] {
  const base = Math.floor(count / groups);
  const remainder = count % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Runs that each begin on the start corner's edge.
 *
 * A run takes whole lines (columns for a vertical priority, rows for a
 * horizontal one) and snakes them, so it ends either back on the start edge or
 * at the far edge — and either way the next run begins on the start edge again,
 * because it starts a fresh line rather than continuing the previous chain.
 *
 * When a single line is longer than one cable can carry, that is impossible:
 * the cabinets left over are above the ones already served. Those runs stack up
 * the line, and the schematic draws their mains down to the floor.
 */
function startEdgeRuns({ cols, rows, priority, start, capacity }: Required<RoutePlan>) {
  const fromRight = start.includes("right");
  const fromBottom = start.includes("bottom");

  const vertical = priority === "vertical";
  /** Lines are columns for a vertical snake, rows for a horizontal one. */
  const lineCount = vertical ? cols : rows;
  const lineLength = vertical ? rows : cols;
  /**
   * Lines are consumed from the start corner inwards: across the columns for a
   * vertical snake, up or down the rows for a horizontal one.
   */
  const linesReversed = vertical ? fromRight : fromBottom;
  const lineAt = (i: number) => (linesReversed ? lineCount - 1 - i : i);
  /** Within a line, the walk runs from the start edge to the far edge. */
  const stepsFromStart = vertical ? fromBottom : fromRight;
  const cellAt = (line: number, step: number): GridPosition => {
    const along = stepsFromStart ? lineLength - 1 - step : step;
    return vertical ? { x: line, y: along } : { x: along, y: line };
  };

  const runs: GridPosition[][] = [];
  const linesPerRun = Math.floor(capacity / lineLength);

  if (linesPerRun < 1) {
    // One line outgrows a cable, so the line itself is split, bottom-up.
    for (let i = 0; i < lineCount; i++) {
      const line = lineAt(i);
      const walk = Array.from({ length: lineLength }, (_, step) => cellAt(line, step));
      runs.push(...balanceIntoRuns(walk, capacity));
    }
    return runs;
  }

  const sizes = evenGroupSizes(lineCount, Math.ceil(lineCount / linesPerRun));
  let consumed = 0;
  for (const size of sizes) {
    const run: GridPosition[] = [];
    for (let offset = 0; offset < size; offset++) {
      const line = lineAt(consumed + offset);
      // Alternate direction per line so the run stays a continuous chain.
      for (let step = 0; step < lineLength; step++) {
        run.push(cellAt(line, offset % 2 === 0 ? step : lineLength - 1 - step));
      }
    }
    consumed += size;
    runs.push(run);
  }
  return runs;
}

/** The cable runs for a grid: the serpentine walk, split by capacity. */
export function planRoutes({ capacity, mains = "start-edge", ...layout }: RoutePlan) {
  requireGridSize(layout.cols, "cols");
  requireGridSize(layout.rows, "rows");
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`capacity must be at least one cabinet, got ${capacity}`);
  }

  if (mains === "continuous") return balanceIntoRuns(serpentineSequence(layout), capacity);
  return startEdgeRuns({ ...layout, capacity, mains });
}
