import { useState } from "react";
import { Grid2X2, ArrowRight } from "lucide-react";
import { DisplayDrawing } from "@/components/DisplayDrawing";
import { fitToWall } from "@/lib/led-calc";
import { useWorkspace } from "./store";
import { blankItem } from "./model";
import { Metric } from "./Bom";
import { toast } from "sonner";
export function Led() {
  const { project: p, updateProject } = useWorkspace();
  const l = p.led;
  const [confirmed, setConfirmed] = useState(false);
  const cabinet = {
    widthMm: l.cabinetWidth,
    heightMm: l.cabinetHeight,
    depthMm: null,
    pixelWidth: l.pixelWidth,
    pixelHeight: l.pixelHeight,
    weightKg: null,
    powerTypicalW: null,
    powerMaxW: null,
  };
  const result = fitToWall(cabinet, l.width, l.height);
  const layout = result.layout;
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>LED configurator</h2>
          <p>Your existing sizing engine and drawings, connected to the project BOM.</p>
        </div>
        <span className="ws-badge">Rectangular cabinet layout</span>
      </div>
      <div className="ws-callout">
        Starting dimensions and cabinet resolution are illustrative. Enter verified product
        specifications; processing compatibility, mounting, power, and cabling still require design.
      </div>
      <div className="ws-led-layout">
        <div className="ws-card">
          <h3>
            <Grid2X2 size={18} />
            Display geometry
          </h3>
          <div className="ws-form-grid">
            {(
              [
                ["width", "Available width (mm)"],
                ["height", "Available height (mm)"],
                ["cabinetWidth", "Cabinet width (mm)"],
                ["cabinetHeight", "Cabinet height (mm)"],
                ["pixelWidth", "Cabinet pixel width"],
                ["pixelHeight", "Cabinet pixel height"],
              ] as const
            ).map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={l[k]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n > 0 && n <= 100000 && (!k.startsWith("pixel") || Number.isInteger(n))) {
                      updateProject({ ...p, led: { ...l, [k]: n } });
                      setConfirmed(false);
                    }
                  }}
                />
              </label>
            ))}
            <label className="wide">
              Supplier cost per m² ({p.currency})
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Not yet priced"
                value={l.costPerSqm ?? ""}
                onChange={(e) => {
                  updateProject({
                    ...p,
                    led: { ...l, costPerSqm: e.target.value ? Number(e.target.value) : null },
                  });
                  setConfirmed(false);
                }}
              />
            </label>
          </div>
          <label className="ws-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I have checked the specifications for this layout.
          </label>
          <button
            className="ws-button primary"
            disabled={!layout || !confirmed || layout.cabinets > 5000}
            onClick={() => {
              if (!layout) return;
              const id = `led-generated-${p.id}`,
                old = p.items.find((i) => i.id === id);
              const i = {
                ...(old ?? blankItem()),
                id,
                description: "LED cabinets · configured display",
                category: "LED",
                quantity: layout.cabinets,
                unit: "ea",
                currency: p.currency,
                fx: 1,
                unitCost:
                  l.costPerSqm === null
                    ? null
                    : Math.round(
                        l.costPerSqm * (l.cabinetWidth / 1000) * (l.cabinetHeight / 1000) * 100,
                      ) / 100,
                drawingRequired: false,
                notes: `${layout.columns} columns × ${layout.rows} rows; ${layout.widthMm} × ${layout.heightMm} mm; ${layout.pixelWidth} × ${layout.pixelHeight} pixels. Layout represented by LED drawing; backend equipment added separately.`,
              };
              updateProject({
                ...p,
                items: old ? p.items.map((x) => (x.id === id ? i : x)) : [...p.items, i],
              });
              toast.success("Cabinet quantities updated in BOM");
            }}
          >
            <ArrowRight size={16} />
            Update project BOM
          </button>
        </div>
        <div>
          {layout && layout.cabinets <= 5000 ? (
            <>
              <div className="ws-metrics compact">
                <Metric
                  label="Cabinets"
                  value={`${layout.columns} × ${layout.rows} = ${layout.cabinets}`}
                />
                <Metric label="Resolution" value={`${layout.pixelWidth} × ${layout.pixelHeight}`} />
                <Metric label="Achieved area" value={`${layout.areaSqm.toFixed(2)} m²`} />
              </div>
              <DisplayDrawing
                layout={layout}
                cabinetWidthMm={l.cabinetWidth}
                cabinetHeightMm={l.cabinetHeight}
                cabinetDepthMm={null}
                mountingDepthMm={null}
                wallWidthMm={l.width}
                wallHeightMm={l.height}
              />
            </>
          ) : (
            <div className="ws-empty">
              {layout ? "Choose a layout of 5,000 cabinets or fewer." : result.message}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
