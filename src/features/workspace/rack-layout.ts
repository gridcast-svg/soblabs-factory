export const RACK_UNITS = 42;

/** Client coordinates work at any fitted scale and while the rack is scrolled. */
export function rackStartForDrop(
  pointerY: number,
  bottom: number,
  unitHeight: number,
  heightU: number,
): number | null {
  if (
    ![pointerY, bottom, unitHeight, heightU].every(Number.isFinite) ||
    unitHeight <= 0 ||
    !Number.isInteger(heightU) ||
    heightU < 1 ||
    heightU > RACK_UNITS
  )
    return null;
  return Math.max(
    1,
    Math.min(RACK_UNITS - heightU + 1, Math.floor((bottom - pointerY) / unitHeight) + 1),
  );
}

export function fitsRack(start: number | null, height: number): boolean {
  return (
    start !== null &&
    Number.isInteger(start) &&
    Number.isInteger(height) &&
    height > 0 &&
    start >= 1 &&
    start + height - 1 <= RACK_UNITS
  );
}
