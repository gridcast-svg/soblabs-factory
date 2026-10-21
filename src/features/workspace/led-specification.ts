import type { LedGeometry } from "./led-schema";
/** Pitch is a planning target. Cabinet pixels must remain whole numbers. */
export function geometryForPitch(g: LedGeometry, pitchMm: number): LedGeometry {
  if (!Number.isFinite(pitchMm) || pitchMm <= 0 || pitchMm > 100)
    throw new Error("Enter a pixel pitch above 0 and at most 100 mm.");
  return {
    ...g,
    pixelWidth: Math.max(1, Math.min(100000, Math.round(g.cabinetWidth / pitchMm))),
    pixelHeight: Math.max(1, Math.min(100000, Math.round(g.cabinetHeight / pitchMm))),
  };
}
