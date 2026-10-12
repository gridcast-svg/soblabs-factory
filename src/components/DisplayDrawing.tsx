import { ExplodedDisplay } from "./ExplodedDisplay";
import type { Layout } from "@/lib/led-calc";

type Props = {
  layout: Layout;
  cabinetWidthMm: number;
  cabinetHeightMm: number;
  cabinetDepthMm: number | null;
  mountingDepthMm: number | null;
  wallWidthMm?: number | null;
  wallHeightMm?: number | null;
};

const DIM = "stroke-[color:var(--muted-foreground)]";

export function DisplayDrawing({
  layout,
  cabinetWidthMm,
  cabinetHeightMm,
  cabinetDepthMm,
  mountingDepthMm,
  wallWidthMm,
  wallHeightMm,
}: Props) {
  const showWall = !!(wallWidthMm && wallHeightMm);
  const outerW = showWall ? Math.max(wallWidthMm!, layout.widthMm) : layout.widthMm;
  const outerH = showWall ? Math.max(wallHeightMm!, layout.heightMm) : layout.heightMm;

  const pad = 70;
  const canvasW = 620;
  const canvasH = 380;
  const scale = Math.min(
    (canvasW - pad * 2) / Math.max(outerW, 1),
    (canvasH - pad * 2) / Math.max(outerH, 1),
  );
  const dw = layout.widthMm * scale;
  const dh = layout.heightMm * scale;
  const ww = (wallWidthMm ?? 0) * scale;
  const wh = (wallHeightMm ?? 0) * scale;
  const x0 = pad + (showWall ? (ww - dw) / 2 : 0);
  const y0 = pad + (showWall ? (wh - dh) / 2 : 0);

  const cw = cabinetWidthMm * scale;
  const ch = cabinetHeightMm * scale;

  const totalDepth =
    cabinetDepthMm != null && mountingDepthMm != null ? cabinetDepthMm + mountingDepthMm : null;

  return (
    <div className="space-y-4">
      <ExplodedDisplay layout={layout} />
      <div className="grid gap-4 md:grid-cols-[1fr_190px]">
        <div className="glass-strong gridlines p-3">
          <svg viewBox={`0 0 ${canvasW} ${canvasH}`} className="w-full">
            {showWall && (
              <>
                <rect
                  x={pad}
                  y={pad}
                  width={ww}
                  height={wh}
                  fill="none"
                  strokeDasharray="4 4"
                  className={DIM}
                  stroke="currentColor"
                  strokeOpacity="0.5"
                />
                <text x={pad} y={pad - 26} fontSize="10" fill="currentColor" fillOpacity="0.5">
                  Wall boundary {Math.round(wallWidthMm!)} × {Math.round(wallHeightMm!)} mm
                </text>
              </>
            )}

            {Array.from({ length: layout.rows }).map((_, r) =>
              Array.from({ length: layout.columns }).map((__, c) => (
                <rect
                  key={`${r}-${c}`}
                  x={x0 + c * cw}
                  y={y0 + r * ch}
                  width={cw}
                  height={ch}
                  fill="var(--brand)"
                  fillOpacity="0.16"
                  stroke="var(--brand)"
                  strokeOpacity="0.55"
                  strokeWidth="0.8"
                />
              )),
            )}

            <rect
              x={x0}
              y={y0}
              width={dw}
              height={dh}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="1.6"
            />

            {/* width dimension */}
            <line
              x1={x0}
              y1={y0 - 14}
              x2={x0 + dw}
              y2={y0 - 14}
              stroke="currentColor"
              strokeOpacity="0.6"
            />
            <text
              x={x0 + dw / 2}
              y={y0 - 19}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              fillOpacity="0.75"
            >
              {Math.round(layout.widthMm)} mm ({(layout.widthMm / 1000).toFixed(3)} m)
            </text>

            {/* height dimension */}
            <line
              x1={x0 - 14}
              y1={y0}
              x2={x0 - 14}
              y2={y0 + dh}
              stroke="currentColor"
              strokeOpacity="0.6"
            />
            <text
              x={x0 - 20}
              y={y0 + dh / 2}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              fillOpacity="0.75"
              transform={`rotate(-90 ${x0 - 20} ${y0 + dh / 2})`}
            >
              {Math.round(layout.heightMm)} mm ({(layout.heightMm / 1000).toFixed(3)} m)
            </text>

            <text
              x={canvasW / 2}
              y={canvasH - 12}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              fillOpacity="0.6"
            >
              Front elevation · {layout.columns} columns × {layout.rows} rows · {layout.cabinets}{" "}
              cabinets of {cabinetWidthMm}×{cabinetHeightMm} mm
            </text>
          </svg>
        </div>

        <div className="glass-strong p-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Side profile
          </div>
          <svg viewBox="0 0 150 220" className="mt-2 w-full">
            <rect
              x="34"
              y="30"
              width={cabinetDepthMm ? Math.min(50, Math.max(10, cabinetDepthMm / 4)) : 24}
              height="150"
              fill="var(--brand)"
              fillOpacity="0.16"
              stroke="var(--brand)"
              strokeOpacity="0.6"
            />
            {mountingDepthMm != null && (
              <rect
                x={34 + (cabinetDepthMm ? Math.min(50, Math.max(10, cabinetDepthMm / 4)) : 24)}
                y="42"
                width={Math.min(40, Math.max(6, mountingDepthMm / 4))}
                height="126"
                fill="none"
                stroke="var(--accent)"
                strokeDasharray="3 3"
              />
            )}
            <text x="8" y="200" fontSize="8" fill="currentColor" fillOpacity="0.6">
              Cabinet depth: {cabinetDepthMm != null ? `${cabinetDepthMm} mm` : "Not specified"}
            </text>
            <text x="8" y="212" fontSize="8" fill="currentColor" fillOpacity="0.6">
              Mounting depth: {mountingDepthMm != null ? `${mountingDepthMm} mm` : "Not specified"}
            </text>
          </svg>
          <div className="mt-2 text-xs text-muted-foreground">
            Total installed depth:{" "}
            <span className="text-foreground">
              {totalDepth != null ? `${totalDepth} mm` : "Not specified"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
