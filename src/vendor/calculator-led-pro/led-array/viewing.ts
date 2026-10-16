/**
 * Pitch against the room it has to be seen from.
 *
 * The app could tell you what a screen does once you had chosen the panel. It
 * could not help you choose it, which is the decision that happens first and
 * costs the most: a pitch too coarse and the front row sees the pixels, a pitch
 * too fine and the client pays for resolution nobody in the room can resolve.
 *
 * Two numbers, and they are not the same kind of thing:
 *
 * - The retina distance is geometry. A 20/20 eye resolves about one arcminute,
 *   so two adjacent pixels merge at 3.44 m per millimetre of pitch. Nothing
 *   about the trade changes it.
 * - The minimum is the trade's own rule of thumb — pitch in millimetres read as
 *   metres — for the closest seat people accept. It is a convention, and it is
 *   labelled as one wherever it is shown.
 */

/**
 * Metres of distance per millimetre of pitch at which a 20/20 eye stops
 * resolving the gap: 1 / tan(1 arcminute), in millimetres, over 1000.
 */
export const ARCMINUTE_METRES_PER_MM = 1 / Math.tan(Math.PI / (180 * 60)) / 1000;

export type ViewingVerdict = "too-close" | "acceptable" | "finer-than-needed";

export interface ViewingInput {
  pitchMm: number;
  /** Where the nearest seat is. Null when nobody has said. */
  audienceDistanceM: number | null;
}

export interface ViewingAdvice {
  pitchMm: number;
  /** Geometry: where the pixels stop being resolvable. */
  retinaDistanceM: number;
  /** Trade convention: the closest seat usually accepted. */
  minimumDistanceM: number;
  verdict: ViewingVerdict | null;
  /**
   * The coarsest pitch that would still look sharp from the declared seat, so
   * an over-specified screen is visible as an over-specified screen.
   */
  coarsestUsefulPitchMm: number | null;
}

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be above zero, got ${value}`);
  }
}

/** "The front row is at 10 m — what pitch do I actually need?" */
export function coarsestPitchForMm(distanceM: number): number {
  requirePositive(distanceM, "distanceM");
  return distanceM / ARCMINUTE_METRES_PER_MM;
}

export function viewingAdvice({ pitchMm, audienceDistanceM }: ViewingInput): ViewingAdvice {
  requirePositive(pitchMm, "pitchMm");
  if (audienceDistanceM !== null) requirePositive(audienceDistanceM, "audienceDistanceM");

  const retinaDistanceM = pitchMm * ARCMINUTE_METRES_PER_MM;
  const minimumDistanceM = pitchMm;

  if (audienceDistanceM === null) {
    return {
      pitchMm,
      retinaDistanceM,
      minimumDistanceM,
      verdict: null,
      coarsestUsefulPitchMm: null,
    };
  }

  const verdict: ViewingVerdict =
    audienceDistanceM < minimumDistanceM
      ? "too-close"
      : audienceDistanceM >= retinaDistanceM
        ? "finer-than-needed"
        : "acceptable";

  return {
    pitchMm,
    retinaDistanceM,
    minimumDistanceM,
    verdict,
    coarsestUsefulPitchMm: coarsestPitchForMm(audienceDistanceM),
  };
}
