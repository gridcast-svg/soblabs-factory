/**
 * Cable colours.
 *
 * On a routing plan the colour *is* the cable's identifier, so the schematic on
 * screen and the schematic in the exported PDF have to agree. Both read these
 * arrays; neither keeps its own copy.
 */

export const DATA_CABLE_COLORS = [
  "#CCFF00",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#f97316",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
] as const;

/**
 * Power used to be five reds, oranges and yellows, which put two problems on
 * one channel. Neighbouring runs were hard to tell apart, and the first cable
 * (`#FF4444`) sat 16 RGB points from the over-capacity red — so on the one
 * layer that can melt a connector, "this run is overloaded" looked exactly like
 * "this run is number one". These are separated by hue, and none of them is
 * red: red belongs to the fault state alone.
 */
export const POWER_CABLE_COLORS = ["#f59e0b", "#22d3ee", "#a78bfa", "#4ade80", "#f472b6"] as const;

/**
 * Marks a run that carries more cabinets than its cable is rated for.
 *
 * Reserved: it appears in neither palette, so it never collides with a cable
 * identity. Colour is still only half the signal — the schematic also breaks
 * the stroke and labels the run, because a fault must survive a colourblind
 * technician and a phone in the dark.
 */
export const OVER_CAPACITY_COLOR = "#ef4444";

/**
 * The same cables, in ink.
 *
 * Screen colours are chosen for a dark UI and several of them vanish on white
 * paper — the lime that identifies the first data cable is barely visible
 * printed. These are the same hues in the same order, darkened for paper, so
 * the third cable on screen is still the third cable on the page. The identity
 * is the position and the hue; the lightness belongs to the medium.
 */
export const PRINT_DATA_CABLE_COLORS = [
  "#7A9900",
  "#0E7490",
  "#047857",
  "#B45309",
  "#C2410C",
  "#1D4ED8",
  "#6D28D9",
  "#A21CAF",
  "#BE185D",
] as const;

export const PRINT_POWER_CABLE_COLORS = [
  "#B45309",
  "#0E7490",
  "#6D28D9",
  "#15803D",
  "#BE185D",
] as const;

/** Reserved on paper too, and dark enough to read. */
export const PRINT_OVER_CAPACITY_COLOR = "#B91C1C";

export type CableLayer = "data" | "power";

export function cableColors(layer: CableLayer): readonly string[] {
  return layer === "data" ? DATA_CABLE_COLORS : POWER_CABLE_COLORS;
}

/** The colour for run `index`, cycling once the palette runs out. */
export function cableColor(layer: CableLayer, index: number): string {
  const colors = cableColors(layer);
  return colors[index % colors.length]!;
}
