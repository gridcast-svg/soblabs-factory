import type { LedGeometry } from "./led-schema";
import type { LedLayer, LedPlan } from "./led-planner";
import {
  cableColor,
  PRINT_DATA_CABLE_COLORS,
  PRINT_POWER_CABLE_COLORS,
} from "@/vendor/calculator-led-pro/routing/palette";

export function ledRoutingSvg(
  g: LedGeometry,
  plan: LedPlan,
  layer: LedLayer,
  print = false,
  theme: "light" | "dark" = "light",
) {
  const l = plan.layout;
  if (!l) return "";
  const scale = Math.min(1040 / l.widthMm, 570 / l.heightMm);
  const cw = g.cabinetWidth * scale,
    ch = g.cabinetHeight * scale;
  const w = cw * l.columns,
    h = ch * l.rows,
    left = (1200 - w) / 2,
    top = (710 - h) / 2;
  const runs = layer === "data" ? plan.dataRuns : plan.powerRuns;
  const capacity = layer === "data" ? plan.dataCapacity : plan.powerCapacity;
  const paper = print || theme === "light";
  const text = paper ? "#24364a" : "#b9c8da",
    grid = paper ? "#a9bdcd" : "#394b60";
  const assignments = new Map<string, { run: number; order: number }>();
  for (const [index, run] of runs.entries())
    run.forEach((p, order) => assignments.set(`${p.x}:${p.y}`, { run: index, order }));
  const color = (n: number) =>
    paper
      ? (layer === "data" ? PRINT_DATA_CABLE_COLORS : PRINT_POWER_CABLE_COLORS)[
          n % (layer === "data" ? PRINT_DATA_CABLE_COLORS.length : PRINT_POWER_CABLE_COLORS.length)
        ]!
      : cableColor(layer, n);
  const parts: string[] = [];
  for (let y = 0; y < l.rows; y++)
    for (let x = 0; x < l.columns; x++) {
      const a = assignments.get(`${x}:${y}`),
        fill = a ? color(a.run) : grid;
      const px = left + x * cw,
        py = top + y * ch;
      parts.push(
        `<g data-cell="${x}:${y}" role="button" tabindex="0" aria-label="Cabinet row ${y + 1} column ${x + 1}"><title>Row ${y + 1}, column ${x + 1}${a ? ` · ${layer} run ${a.run + 1}, position ${a.order + 1}` : " · unrouted"}</title><rect x="${px + 0.7}" y="${py + 0.7}" width="${Math.max(0.1, cw - 1.4)}" height="${Math.max(0.1, ch - 1.4)}" fill="${fill}" fill-opacity=".12" stroke="${fill}" stroke-width=".8"/>${cw > 28 && ch > 22 ? `<text x="${px + cw / 2}" y="${py + ch * 0.7}" text-anchor="middle" font-size="${Math.min(11, cw / 5, ch / 4)}" fill="${text}" pointer-events="none">${a ? `${a.run + 1}.${a.order + 1}` : `${y + 1}:${x + 1}`}</text>` : ""}</g>`,
      );
    }
  for (const [index, run] of runs.entries()) {
    const points = run.map((p) => `${left + (p.x + 0.5) * cw},${top + (p.y + 0.4) * ch}`).join(" ");
    const start = run[0];
    const fault = capacity !== null && run.length > capacity;
    if (!start) continue;
    const stroke = fault ? "#db4545" : color(index);
    const sx = left + (start.x + 0.5) * cw,
      sy = top + (start.y + 0.4) * ch;
    parts.push(
      `<g pointer-events="none"><polyline points="${points}" stroke="${stroke}" stroke-width="2.3" fill="none" ${fault ? 'stroke-dasharray="5 4"' : ""}/><line x1="${sx}" y1="${sy}" x2="${sx}" y2="${top + h + 20}" stroke="${stroke}" stroke-width="1" stroke-dasharray="3 4"/><circle cx="${sx}" cy="${sy}" r="${Math.min(5, cw / 5, ch / 5)}" fill="${stroke}"/></g>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 780" width="1200" height="780" aria-label="LED ${layer} routing drawing"><rect width="1200" height="780" fill="${print ? "#ffffff" : theme === "light" ? "#f2eee5" : "#151612"}"/><g font-family="Arial,sans-serif"><text x="36" y="30" fill="${text}" font-size="14">${layer === "data" ? "DATA" : "POWER"} ROUTING · ${l.columns} columns × ${l.rows} rows · ${l.cabinets} cabinets</text><line x1="${left}" y1="${top - 20}" x2="${left + w}" y2="${top - 20}" stroke="${grid}"/><text x="600" y="${top - 28}" text-anchor="middle" font-size="12" fill="${text}">${l.widthMm} mm · ${l.pixelWidth} px</text><text x="${left - 14}" y="${top + h / 2}" text-anchor="middle" transform="rotate(-90 ${left - 14} ${top + h / 2})" font-size="12" fill="${text}">${l.heightMm} mm · ${l.pixelHeight} px</text>${parts.join("")}<text x="36" y="746" fill="${text}" font-size="12">${runs.filter((r) => r.length).length} runs · ${capacity === null ? "Capacity not specified" : `${capacity} cabinets per ${layer === "data" ? "port" : "circuit"}`} · Dot = start; dashed drop = main to floor</text><text x="36" y="767" fill="${text}" font-size="11">Routing view as drawn. Confirm front/rear orientation, connectors and cable paths on site.</text></g></svg>`;
}
