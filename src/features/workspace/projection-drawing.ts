import type { ProjectionConfig } from "./projection-schema";
import type { ProjectionPlan } from "./projection-planner";
export type ProjectionView = "elevation" | "plan";

export function projectionSvg(
  c: ProjectionConfig,
  plan: ProjectionPlan,
  view: ProjectionView,
  print = false,
  theme: "light" | "dark" = "light",
): string {
  const s = plan.solution;
  if (!s) return "";
  const paper = print || theme === "light";
  const ink = paper ? "#263e50" : "#bdcedd",
    cyan = paper ? "#067c91" : "#87e5e9",
    amber = paper ? "#a16417" : "#e8ad59";
  const parts: string[] = [];
  if (view === "elevation") {
    const outerW = Math.max(c.widthM, s.coveredWidth),
      outerH = Math.max(c.heightM, s.coveredHeight);
    const scale = Math.min(1050 / outerW, 550 / outerH);
    const ox = (1200 - outerW * scale) / 2,
      oy = (700 - outerH * scale) / 2;
    const tx = ox + ((outerW - s.coveredWidth) * scale) / 2,
      ty = oy + ((outerH - s.coveredHeight) * scale) / 2;
    const px = s.tileWidth * (1 - s.hOverlap) * scale,
      py = s.tileHeight * (1 - s.vOverlap) * scale;
    const tw = s.tileWidth * scale,
      th = s.tileHeight * scale;
    for (let col = 0; col < c.columns - 1; col++)
      parts.push(
        `<rect x="${tx + col * px + tw - s.hOverlapMetres * scale}" y="${ty}" width="${s.hOverlapMetres * scale}" height="${s.coveredHeight * scale}" fill="${amber}" opacity=".25"/>`,
      );
    for (let row = 0; row < c.rows - 1; row++)
      parts.push(
        `<rect x="${tx}" y="${ty + row * py + th - s.vOverlapMetres * scale}" width="${s.coveredWidth * scale}" height="${s.vOverlapMetres * scale}" fill="${amber}" opacity=".25"/>`,
      );
    const labels: string[] = [];
    for (const p of plan.placements) {
      const x = tx + p.column * px,
        y = ty + p.row * py;
      parts.push(
        `<g data-projection-position="${p.tag}"><rect x="${x}" y="${y}" width="${tw}" height="${th}" fill="${cyan}" fill-opacity=".035" stroke="${cyan}" stroke-width="1.5"/></g>`,
      );
      const font = Math.min(13, tw / 10, th / 5);
      if (tw > 28 && th > 18)
        labels.push(
          `<g><rect x="${x + 4}" y="${y + 4}" width="${Math.min(tw - 6, p.tag.length * font * 0.65 + 10)}" height="${font + 10}" fill="${print ? "#ffffff" : theme === "light" ? "#f2eee5" : "#151612"}" fill-opacity=".95"/><text x="${x + 8}" y="${y + font + 9}" font-size="${font}" fill="${cyan}">${p.tag}</text></g>`,
        );
    }
    const sx = ox + ((outerW - c.widthM) * scale) / 2,
      sy = oy + ((outerH - c.heightM) * scale) / 2;
    parts.push(
      `<rect x="${sx}" y="${sy}" width="${c.widthM * scale}" height="${c.heightM * scale}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-dasharray="7 4"/><text x="600" y="${oy - 20}" text-anchor="middle" font-size="14" fill="${ink}">${c.widthM.toFixed(3)} m ${c.kind === "cylindrical" ? "arc length (unwrapped)" : "screen width"} × ${c.heightM.toFixed(3)} m height</text>`,
    );
    parts.push(...labels);
  } else {
    const screenPoint = (x: number) =>
      c.kind === "flat"
        ? { x, y: 0 }
        : { x: c.radiusM * Math.sin(x / c.radiusM), y: c.radiusM * (1 - Math.cos(x / c.radiusM)) };
    const points = Array.from({ length: 161 }, (_, n) =>
      screenPoint(-c.widthM / 2 + (c.widthM * n) / 160),
    );
    const rigs = s.columns.map((col) => {
      const offset = (col.column - (c.columns - 1) / 2) * s.tileWidth * (1 - s.hOverlap);
      const phi = offset / c.radiusM;
      const origin =
        c.placement === "common-point"
          ? { x: 0, y: c.throwDistanceM }
          : c.kind === "flat"
            ? { x: offset, y: c.throwDistanceM }
            : {
                x: (c.radiusM - c.throwDistanceM) * Math.sin(phi),
                y: c.radiusM - (c.radiusM - c.throwDistanceM) * Math.cos(phi),
              };
      return {
        origin,
        left: screenPoint(offset - s.tileWidth / 2),
        right: screenPoint(offset + s.tileWidth / 2),
        column: col.column,
      };
    });
    const roomCorners = c.room
      ? [
          { x: -c.room.widthM / 2, y: 0 },
          { x: c.room.widthM / 2, y: c.room.depthM },
        ]
      : [];
    const all = [...roomCorners, ...points, ...rigs.flatMap((r) => [r.origin, r.left, r.right])];
    const minX = Math.min(...all.map((p) => p.x)),
      maxX = Math.max(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y)),
      maxY = Math.max(...all.map((p) => p.y));
    const scale = Math.min(1040 / Math.max(0.1, maxX - minX), 530 / Math.max(0.1, maxY - minY));
    const ox = (1200 - (maxX - minX) * scale) / 2,
      oy = (710 - (maxY - minY) * scale) / 2;
    const pos = (p: { x: number; y: number }) =>
      `${ox + (p.x - minX) * scale},${oy + (p.y - minY) * scale}`;
    if (c.room)
      parts.push(
        `<g data-room-boundary="true"><rect x="${ox + (-c.room.widthM / 2 - minX) * scale}" y="${oy - minY * scale}" width="${c.room.widthM * scale}" height="${c.room.depthM * scale}" fill="none" stroke="${ink}" stroke-dasharray="8 5" stroke-width="1.5"/><text x="600" y="705" text-anchor="middle" fill="${ink}" font-size="12">Room ${c.room.widthM} × ${c.room.depthM} m · height ${c.room.heightM} m</text></g>`,
      );
    for (const r of rigs)
      parts.push(
        `<g data-projection-column="${r.column}"><polygon points="${pos(r.origin)} ${pos(r.left)} ${pos(r.right)}" fill="${cyan}" fill-opacity=".07" stroke="${cyan}" stroke-width="1"/><circle cx="${ox + (r.origin.x - minX) * scale}" cy="${oy + (r.origin.y - minY) * scale}" r="5" fill="${amber}"/></g>`,
      );
    parts.push(
      `<polyline points="${points.map(pos).join(" ")}" fill="none" stroke="${ink}" stroke-width="3"/><text x="600" y="65" text-anchor="middle" font-size="14" fill="${ink}">${c.kind === "cylindrical" ? `Radius ${c.radiusM.toFixed(2)} m · wrap ${s.wrapAngleDeg.toFixed(1)}°` : "Flat screen"} · nominal throw ${c.throwDistanceM.toFixed(3)} m</text>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 780" width="1200" height="780" role="img" aria-label="Projection ${view} drawing"><rect width="1200" height="780" fill="${print ? "#ffffff" : theme === "light" ? "#f2eee5" : "#151612"}"/><g font-family="Arial,sans-serif"><text x="28" y="30" font-size="14" fill="${ink}">${view === "elevation" ? "FRONT ELEVATION" : "PLAN VIEW"} · ${c.columns} columns × ${c.rows} rows · ${c.columns * c.rows} projectors</text>${parts.join("")}<text x="28" y="740" font-size="12" fill="${ink}">${view === "elevation" ? "Amber = blended overlap; dashed outline = requested screen" : "Triangles show horizontal coverage by column; stacked rows share this plan view"}</text><text x="28" y="765" font-size="11" fill="${ink}">Geometric planning only. Verify lens shift, physical positions, optical losses and site conditions.</text></g></svg>`;
}
