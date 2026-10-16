/**
 * What the screen weighs, and where that weight lands.
 *
 * The app already treats current as something that can hurt someone — derated
 * breakers, a reserved alarm colour, a total against the venue feed. Weight is
 * the other hazard in this trade and it was a single figure with no decision
 * attached to it: "510 kg" tells a rigger nothing they can act on.
 *
 * IMPORTANT: this is arithmetic on a declared rig, not a structural
 * calculation. It can say a screen asks 85 kg of each of six points. It cannot
 * say the truss, the motor or the bumper will take it — that is signed for by
 * someone qualified, and the app never pretends otherwise.
 */

export type MountMode = "flown" | "stacked";

export interface RiggingInput {
  mount: MountMode;
  cols: number;
  rows: number;
  cabinetWeightKg: number;
  /** Hanging points. Null when stacked, or when nobody has declared them yet. */
  points: number | null;
  /**
   * What one point is rated for when flown, or what the bottom cabinet may
   * carry when stacked. Null means nobody declared it: the app reports the load
   * and refuses to say whether it fits.
   */
  pointCapacityKg: number | null;
}

export interface RiggingLoad {
  totalKg: number;
  /** One column of cabinets — what a single pick or base plate carries. */
  heaviestColumnKg: number;
  /** Flown only. */
  perPointKg: number | null;
  /** Stacked only: everything resting on the bottom cabinet of a column. */
  onBottomCabinetKg: number;
  /** False when the points do not land on cabinet joints. */
  evenlyDivided: boolean;
  pointCapacityKg: number | null;
  overCapacity: boolean;
  headroomPercent: number | null;
}

function requireWhole(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a whole number above zero, got ${value}`);
  }
}

export function riggingLoad({
  mount,
  cols,
  rows,
  cabinetWeightKg,
  points,
  pointCapacityKg,
}: RiggingInput): RiggingLoad {
  requireWhole(cols, "cols");
  requireWhole(rows, "rows");
  if (!Number.isFinite(cabinetWeightKg) || cabinetWeightKg <= 0) {
    throw new RangeError(`cabinetWeightKg must be above zero, got ${cabinetWeightKg}`);
  }
  if (pointCapacityKg !== null && (!Number.isFinite(pointCapacityKg) || pointCapacityKg <= 0)) {
    throw new RangeError(`pointCapacityKg must be above zero, got ${pointCapacityKg}`);
  }

  const totalKg = cols * rows * cabinetWeightKg;
  const heaviestColumnKg = rows * cabinetWeightKg;
  // A stacking limit is written against what rests ON the bottom cabinet, which
  // is the column minus the cabinet itself.
  const onBottomCabinetKg = (rows - 1) * cabinetWeightKg;

  if (mount === "stacked") {
    const overCapacity = pointCapacityKg !== null && onBottomCabinetKg > pointCapacityKg;
    return {
      totalKg,
      heaviestColumnKg,
      perPointKg: null,
      onBottomCabinetKg,
      evenlyDivided: true,
      pointCapacityKg,
      overCapacity,
      headroomPercent:
        pointCapacityKg === null
          ? null
          : Math.max(0, ((pointCapacityKg - onBottomCabinetKg) / pointCapacityKg) * 100),
    };
  }

  // Null is "nobody has decided yet", which is the state the app opens in and a
  // perfectly good thing to report a weight for. Zero or a fraction is a rig
  // that cannot exist, and that is an error. Conflating the two threw a
  // RangeError out of the first render of the panel.
  if (points !== null) requireWhole(points, "points");

  const perPointKg = points === null ? null : totalKg / points;
  const overCapacity =
    perPointKg !== null && pointCapacityKg !== null && perPointKg >= pointCapacityKg;

  return {
    totalKg,
    heaviestColumnKg,
    perPointKg,
    onBottomCabinetKg,
    // Picks that fall between cabinets are a drawing, not a rig.
    evenlyDivided: points === null || cols % points === 0,
    pointCapacityKg,
    overCapacity,
    headroomPercent:
      perPointKg === null || pointCapacityKg === null
        ? null
        : Math.max(0, ((pointCapacityKg - perPointKg) / pointCapacityKg) * 100),
  };
}
