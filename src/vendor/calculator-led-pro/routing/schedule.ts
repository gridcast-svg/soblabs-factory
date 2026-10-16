/**
 * The pull sheet: how much cable the plan actually needs.
 *
 * The routing says how many cables. It never said how long, so the number that
 * decides whether the truck carries enough was the one thing the app would not
 * tell you — and running short of cable is discovered at load-in, in front of
 * everybody, with no way to fix it.
 *
 * A main is measured from the source to the first cabinet it feeds: across the
 * floor, up to the bottom of the screen, and then up to the run's own start,
 * which is why a stacked run's main is longer than the one under it.
 */

import type { GridPosition } from "./serpentine";

/** What cable is actually made in, in metres. Anything else is a custom order. */
export const STANDARD_LENGTHS_M = [1, 2, 3, 5, 10, 15, 20, 25, 30, 50] as const;

export interface CableScheduleInput {
  runs: GridPosition[][];
  cabinetWidthMm: number;
  cabinetHeightMm: number;
  rows: number;
  /** Metres from the floor to the bottom edge of the screen. */
  trimHeightM: number;
  /** Metres across the floor from the rack to the screen. */
  distanceToSourceM: number;
  /** Proportion added for dressing, ties and the route not being a straight line. */
  slack: number;
}

export interface CableRunLength {
  /** 1-based, matching the number printed on the schematic. */
  cable: number;
  cabinets: number;
  /** Metres from the bottom of the screen up to this run's first cabinet. */
  climbM: number;
  /** What the route actually measures, before rounding. */
  rawLengthM: number;
  /** The cable you would take off the shelf. */
  mainLengthM: number;
  jumpers: number;
}

export interface CableSchedule {
  runs: CableRunLength[];
  totalMains: number;
  totalJumpers: number;
  mainsByLength: { lengthM: number; count: number }[];
  /** True when a run needs more than the longest cable on the list. */
  beyondLongestCable: boolean;
}

const LONGEST = STANDARD_LENGTHS_M[STANDARD_LENGTHS_M.length - 1]!;

/** The shortest cable that reaches, or the longest one made. */
const roundUp = (metres: number): number =>
  STANDARD_LENGTHS_M.find((length) => length >= metres) ?? LONGEST;

function requireAtLeastZero(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} cannot be negative, got ${value}`);
  }
}

export function cableSchedule({
  runs,
  cabinetHeightMm,
  rows,
  trimHeightM,
  distanceToSourceM,
  slack,
}: CableScheduleInput): CableSchedule {
  requireAtLeastZero(trimHeightM, "trimHeightM");
  requireAtLeastZero(distanceToSourceM, "distanceToSourceM");
  requireAtLeastZero(slack, "slack");

  const cabinetHeightM = cabinetHeightMm / 1000;
  const drawn = runs.filter((run) => run.length > 0);

  const measured = drawn.map((run, index): CableRunLength => {
    // Row 0 is the top, so a run starting low has little to climb.
    const climbM = (rows - 1 - run[0]!.y) * cabinetHeightM;
    const rawLengthM = (distanceToSourceM + trimHeightM + climbM) * (1 + slack);

    return {
      cable: index + 1,
      cabinets: run.length,
      climbM,
      rawLengthM,
      mainLengthM: roundUp(rawLengthM),
      // Six cabinets on one cable are joined by five jumpers.
      jumpers: run.length - 1,
    };
  });

  const counts = new Map<number, number>();
  for (const run of measured) counts.set(run.mainLengthM, (counts.get(run.mainLengthM) ?? 0) + 1);

  return {
    runs: measured,
    totalMains: measured.length,
    totalJumpers: measured.reduce((total, run) => total + run.jumpers, 0),
    mainsByLength: [...counts.entries()]
      .map(([lengthM, count]) => ({ lengthM, count }))
      .sort((a, b) => a.lengthM - b.lengthM),
    beyondLongestCable: measured.some((run) => run.rawLengthM > LONGEST),
  };
}
