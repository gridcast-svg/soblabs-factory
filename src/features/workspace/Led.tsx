import { useEffect, useState } from "react";
import { ArrowRight, Download, Maximize2, Save } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./store";
import {
  calculateLedPlan,
  ledBomLines,
  applyLedBom,
  saveLedDesign,
  type LedLayer,
} from "./led-planner";
import type { LedGeometry, LedPlannerConfig } from "./led-schema";
import { ledRoutingSvg } from "./led-drawing";
import { ledCableCsv, ledReportPdf } from "./led-export";
import { download } from "./files";
import { Metric } from "./Bom";
import type { LedDesign } from "./model";
import "./led-planner.css";

function NumberField({
  label,
  value,
  onChange,
  optional = false,
  min = 0.001,
  max = 1000000000,
  whole = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  optional?: boolean;
  min?: number;
  max?: number;
  whole?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => setText(value === null ? "" : String(value)), [value]);
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={whole ? 1 : "any"}
        placeholder={optional ? "Not specified" : undefined}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (!raw) {
            if (optional) onChange(null);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n) && n >= min && n <= max && (!whole || Number.isInteger(n)))
            onChange(n);
        }}
        onBlur={() => setText(value === null ? "" : String(value))}
      />
    </label>
  );
}

export function Led() {
  const { project: p, updateProject } = useWorkspace();
  const g = p.led,
    c = p.ledPlanner,
    plan = calculateLedPlan(g, c),
    l = plan.layout;
  const [tab, setTab] = useState("Layout");
  const [layer, setLayer] = useState<LedLayer>("data");
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [verified, setVerified] = useState("");
  const [title, setTitle] = useState("LED design 01");
  const [exporting, setExporting] = useState(false);
  const signature = JSON.stringify([p.id, g, c]);
  const lines = ledBomLines(p);
  const invalid =
    !l ||
    plan.routeErrors.length > 0 ||
    plan.dataCapacity === 0 ||
    plan.powerCapacity === 0 ||
    !!plan.dataSchedule?.beyondLongestCable ||
    !!plan.powerSchedule?.beyondLongestCable ||
    !!plan.rigging?.overCapacity ||
    (c.maxPowerW !== null && c.typicalPowerW !== null && c.typicalPowerW > c.maxPowerW);
  const mode = layer === "data" ? c.dataMode : c.powerMode;
  const manual = layer === "data" ? c.manualData : c.manualPower;
  const runs = layer === "data" ? plan.dataRuns : plan.powerRuns;
  const capacity = layer === "data" ? plan.dataCapacity : plan.powerCapacity;
  const patch = (change: Partial<LedPlannerConfig>) =>
    updateProject({ ...p, ledPlanner: { ...c, ...change } });
  const geometry = (change: Partial<LedGeometry>) =>
    updateProject({ ...p, led: { ...g, ...change } });
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  function editRuns(next: typeof manual) {
    patch(layer === "data" ? { manualData: next } : { manualPower: next });
  }
  function selectCell(target: EventTarget | null) {
    if (mode !== "manual" || !capacity) return;
    const cell = (target as Element | null)?.closest("[data-cell]")?.getAttribute("data-cell");
    if (!cell) return;
    const [x, y] = cell.split(":").map(Number) as [number, number];
    if (manual.some((run) => run.some((p) => p.x === x && p.y === y))) {
      toast.error("This cabinet is already assigned. Undo the last cabinet or clear this layer.");
      return;
    }
    const next = manual.map((r) => [...r]);
    if (!next.length) next.push([]);
    const active = next[next.length - 1]!;
    if (active.length >= capacity) {
      toast.error("Run is at capacity. Start a new run.");
      return;
    }
    const last = active.at(-1);
    if (last && Math.abs(last.x - x) + Math.abs(last.y - y) !== 1) {
      toast.error("Choose an adjacent cabinet or start a new run.");
      return;
    }
    active.push({ x, y });
    editRuns(next);
  }
  async function report(saved?: LedDesign) {
    setExporting(true);
    try {
      download(`Soblabs-LED-${saved ? saved.id : "current"}.pdf`, await ledReportPdf(p, saved));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to export report");
    } finally {
      setExporting(false);
    }
  }
  const configNumber = (
    key: keyof LedPlannerConfig,
    label: string,
    optional = true,
    whole = false,
    min = 0.001,
    max = 1000000000,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={c[key] as number | null}
      optional={optional}
      whole={whole}
      min={min}
      max={max}
      onChange={(value) => patch({ [key]: value })}
    />
  );
  const textField = (
    key: "cabinetManufacturer" | "cabinetModel" | "processorModel" | "specSource",
    label: string,
    maxLength = 120,
  ) => (
    <label key={key}>
      {label}
      <input
        value={c[key]}
        maxLength={maxLength}
        onChange={(e) => patch({ [key]: e.target.value })}
      />
    </label>
  );

  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>LED configurator</h2>
          <p>Plan the display, its distribution and the materials to build it.</p>
        </div>
        <a
          className="ws-badge"
          href="https://github.com/matecodedev/calculator-led-pro"
          target="_blank"
          rel="noreferrer"
        >
          Calculator LED Pro · MIT
        </a>
      </div>
      <div className="ws-led-planner">
        <aside className="ws-led-controls ws-card">
          <div className="ws-led-tabs" role="tablist" aria-label="LED planning controls">
            {["Layout", "Cabinet", "Processing", "Installation"].map((name) => (
              <button
                key={name}
                role="tab"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={`${tab} controls`} className="ws-form-grid">
            {tab === "Layout" && (
              <>
                <label className="wide">
                  Sizing mode
                  <select
                    value={c.mode}
                    onChange={(e) => patch({ mode: e.target.value as "wall" | "count" })}
                  >
                    <option value="wall">Fit within available wall</option>
                    <option value="count">Cabinet columns × rows</option>
                  </select>
                </label>
                {c.mode === "wall" ? (
                  <>
                    {(
                      [
                        ["width", "Available width (mm)"],
                        ["height", "Available height (mm)"],
                      ] as const
                    ).map(([key, label]) => (
                      <NumberField
                        key={key}
                        label={label}
                        value={g[key]}
                        max={10000000}
                        onChange={(value) => geometry({ [key]: value! })}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    {configNumber("columns", "Cabinet columns", false, true, 1, 5000)}
                    {configNumber("rows", "Cabinet rows", false, true, 1, 5000)}
                  </>
                )}
                {(
                  [
                    ["cabinetWidth", "Cabinet width (mm)"],
                    ["cabinetHeight", "Cabinet height (mm)"],
                    ["pixelWidth", "Cabinet pixel width"],
                    ["pixelHeight", "Cabinet pixel height"],
                  ] as const
                ).map(([key, label]) => (
                  <NumberField
                    key={key}
                    label={label}
                    value={g[key]}
                    whole={key.startsWith("pixel")}
                    max={100000}
                    onChange={(value) => geometry({ [key]: value! })}
                  />
                ))}
                <p className="wide ws-led-help">
                  Exact cabinet pixels drive the resolution. Wall-fit always rounds down to whole
                  cabinets.
                </p>
                <NumberField
                  label={`Supplier cost per m² (${p.currency})`}
                  value={g.costPerSqm}
                  optional
                  min={0}
                  onChange={(value) => geometry({ costPerSqm: value })}
                />
              </>
            )}
            {tab === "Cabinet" && (
              <>
                {textField("cabinetManufacturer", "Cabinet manufacturer")}
                {textField("cabinetModel", "Cabinet model / part number")}
                {configNumber("weightKg", "Cabinet weight (kg)")}
                {configNumber("maxPowerW", "Maximum cabinet power (W)")}
                {configNumber("typicalPowerW", "Typical cabinet power (W)")}
                {configNumber("audienceDistanceM", "Nearest audience distance (m)")}
                <div className="wide">
                  {textField("specSource", "Specification source / datasheet reference", 1000)}
                </div>
                <p className="wide ws-led-help">
                  Enter your product's verified specifications. Unknown values stay blank; no
                  product catalogue is assumed.
                </p>
              </>
            )}
            {tab === "Processing" && (
              <>
                <div className="wide">{textField("processorModel", "Processor model")}</div>
                {configNumber("pixelsPerPort", "Pixels per data port", true, true)}
                {configNumber("dataPorts", "Data ports per processor", true, true, 1, 1024)}
                {configNumber("processorPixels", "Total pixels per processor", true, true)}
                {configNumber("canvasWidth", "Maximum canvas width (px)", true, true)}
                {configNumber("canvasHeight", "Maximum canvas height (px)", true, true)}
                <p className="wide ws-led-help">
                  Use limits for the actual refresh rate and bit depth. Quantities are a planning
                  minimum; receiver compatibility, redundancy and canvas partitioning require
                  review.
                </p>
              </>
            )}
            {tab === "Installation" && (
              <>
                {configNumber("voltage", "Supply voltage (V)", false, false, 1, 1000)}
                {configNumber("breakerAmps", "Breaker rating (A)", false, false, 1, 10000)}
                {configNumber(
                  "connectorAmps",
                  "Cable / connector rating (A)",
                  false,
                  false,
                  1,
                  10000,
                )}
                {configNumber(
                  "sourceDistanceM",
                  "Rack to screen distance (m)",
                  false,
                  false,
                  0,
                  10000,
                )}
                {configNumber(
                  "trimHeightM",
                  "Screen bottom above floor (m)",
                  false,
                  false,
                  0,
                  1000,
                )}
                {configNumber("slackPercent", "Cable allowance (%)", false, false, 0, 100)}
                <label>
                  Mounting method
                  <select
                    value={c.mount}
                    onChange={(e) => patch({ mount: e.target.value as "stacked" | "flown" })}
                  >
                    <option value="stacked">Ground / wall supported</option>
                    <option value="flown">Flown</option>
                  </select>
                </label>
                {c.mount === "flown" &&
                  configNumber("hangingPoints", "Hanging points", true, true, 1, 5000)}
                {configNumber(
                  "pointCapacityKg",
                  c.mount === "flown"
                    ? "Rated capacity per point (kg)"
                    : "Rated load on bottom cabinet (kg)",
                )}
                <p className="wide ws-led-help">
                  Breaker planning uses 80% of its rating, capped by the connector rating. Current
                  assumes power factor 1. Rigging shows cabinet loads only, excluding structure and
                  dynamic loads.
                </p>
              </>
            )}
          </div>
          <div className="ws-led-attribution">
            Calculation modules adapted from{" "}
            <a href="/licenses/calculator-led-pro.txt" target="_blank" rel="noreferrer">
              Calculator LED Pro (MIT)
            </a>
            .
          </div>
        </aside>
        <div className="ws-led-workarea">
          <div className="ws-metrics compact">
            <Metric
              label="Cabinets"
              value={l ? `${l.columns} × ${l.rows} = ${l.cabinets}` : "No valid layout"}
            />
            <Metric label="Resolution" value={l ? `${l.pixelWidth} × ${l.pixelHeight}` : "—"} />
            <Metric
              label="Achieved size"
              value={
                l ? `${(l.widthMm / 1000).toFixed(2)} × ${(l.heightMm / 1000).toFixed(2)} m` : "—"
              }
            />
          </div>
          <section
            className={`ws-led-stage${expanded ? " is-expanded" : ""}`}
            aria-label="LED routing editor"
          >
            <div className="ws-led-stagebar">
              <strong>{p.name} / LED routing</strong>
              <button className="ws-button" onClick={() => setExpanded(!expanded)}>
                <Maximize2 size={14} />
                {expanded ? "Return to Factory" : "Expand LED planner"}
              </button>
            </div>
            <div className="ws-led-routebar">
              <label>
                Routing layer
                <select
                  aria-label="Routing layer"
                  value={layer}
                  onChange={(e) => setLayer(e.target.value as LedLayer)}
                >
                  <option value="data">Data</option>
                  <option value="power">Power</option>
                </select>
              </label>
              <label>
                Route mode
                <select
                  aria-label="Route mode"
                  value={mode}
                  onChange={(e) => {
                    const value = e.target.value as "auto" | "manual";
                    patch(
                      layer === "data"
                        ? {
                            dataMode: value,
                            manualData: mode === "auto" ? structuredClone(runs) : manual,
                          }
                        : {
                            powerMode: value,
                            manualPower: mode === "auto" ? structuredClone(runs) : manual,
                          },
                    );
                  }}
                >
                  <option value="auto">Automatic</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label>
                Direction
                <select
                  value={c.priority}
                  onChange={(e) => patch({ priority: e.target.value as "vertical" | "horizontal" })}
                >
                  <option value="vertical">Vertical</option>
                  <option value="horizontal">Horizontal</option>
                </select>
              </label>
              <label>
                Start corner
                <select
                  value={c.start}
                  onChange={(e) => patch({ start: e.target.value as LedPlannerConfig["start"] })}
                >
                  {["bottom-left", "bottom-right", "top-left", "top-right"].map((v) => (
                    <option key={v} value={v}>
                      {v.replace("-", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Main routing
                <select
                  value={c.mains}
                  onChange={(e) => patch({ mains: e.target.value as LedPlannerConfig["mains"] })}
                >
                  <option value="start-edge">Start-edge runs</option>
                  <option value="continuous">Continuous snake</option>
                </select>
              </label>
              <div className="ws-led-zoom">
                <button
                  aria-label="Zoom out LED drawing"
                  onClick={() => setZoom(Math.max(1, zoom - 0.5))}
                >
                  −
                </button>
                <button onClick={() => setZoom(1)}>Fit drawing</button>
                <button
                  aria-label="Zoom in LED drawing"
                  onClick={() => setZoom(Math.min(4, zoom + 0.5))}
                >
                  +
                </button>
              </div>
            </div>
            {mode === "manual" && (
              <div className="ws-led-manual">
                <span>Click adjacent cabinets to build the active run.</span>
                <button
                  className="ws-button"
                  disabled={!capacity}
                  onClick={() => editRuns([...manual.filter((r) => r.length), []])}
                >
                  New run
                </button>
                <button
                  className="ws-button"
                  disabled={!manual.some((r) => r.length)}
                  onClick={() => {
                    const next = manual.filter((r) => r.length).map((r) => [...r]);
                    next.at(-1)?.pop();
                    editRuns(next);
                  }}
                >
                  Undo cabinet
                </button>
                <button className="ws-button" onClick={() => editRuns([])}>
                  Clear layer
                </button>
                <button
                  className="ws-button"
                  onClick={() =>
                    patch(layer === "data" ? { dataMode: "auto" } : { powerMode: "auto" })
                  }
                >
                  Auto-route layer
                </button>
              </div>
            )}
            <div className={`ws-led-canvas ${mode === "manual" ? "is-manual" : ""}`}>
              {l ? (
                <div
                  className="ws-led-svg"
                  style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
                  onClick={(e) => selectCell(e.target)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectCell(e.target);
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: ledRoutingSvg(g, plan, layer) }}
                />
              ) : (
                <div className="ws-empty">{plan.issues[0]}</div>
              )}
            </div>
            <div className="ws-led-stagefoot">
              {capacity === null
                ? "Enter product specifications to calculate routing."
                : capacity === 0
                  ? "Capacity exceeded: one cabinet will not fit."
                  : `${runs.filter((r) => r.length).length} ${layer} runs · up to ${capacity} cabinets per ${layer === "data" ? "port" : "circuit"}`}
              <span>Routing view as drawn · verify front/rear orientation</span>
            </div>
          </section>
          <div className="ws-led-exportbar">
            <button className="ws-button" disabled={!l || exporting} onClick={() => void report()}>
              <Download size={14} />
              {exporting ? "Preparing report…" : "Export LED PDF"}
            </button>
            <button
              className="ws-button"
              disabled={!l}
              onClick={() =>
                download(`LED-${layer}.svg`, ledRoutingSvg(g, plan, layer, true), "image/svg+xml")
              }
            >
              Export routing SVG
            </button>
            <button
              className="ws-button"
              disabled={!plan.dataSchedule && !plan.powerSchedule}
              onClick={() => download("LED-cable-schedule.csv", ledCableCsv(p), "text/csv")}
            >
              Cable schedule CSV
            </button>
          </div>
        </div>
      </div>
      <div className="ws-led-summary-grid">
        <section className="ws-card">
          <h3>System requirements</h3>
          <dl className="ws-led-facts">
            <dt>Cabinet area / weight</dt>
            <dd>
              {l
                ? `${l.areaSqm.toFixed(2)} m² / ${l.weightKg === null ? "Weight not specified" : l.weightKg.toFixed(1) + " kg"}`
                : "—"}
            </dd>
            <dt>Maximum / typical power</dt>
            <dd>
              {plan.electrical
                ? `${plan.electrical.maximumW.toLocaleString()} W / ${plan.electrical.typicalW === null ? "Not specified" : plan.electrical.typicalW.toLocaleString() + " W"}`
                : "Maximum cabinet power not specified"}
            </dd>
            <dt>Maximum current / usable per circuit</dt>
            <dd>
              {plan.electrical
                ? `${plan.electrical.maximumA.toFixed(1)} A / ${plan.electrical.usableAmps.toFixed(1)} A at ${c.voltage} V`
                : "Not calculated"}
            </dd>
            <dt>Processors (estimated minimum)</dt>
            <dd>{plan.demand?.processorsNeeded ?? "Processor limits incomplete"}</dd>
            <dt>Data / power mains</dt>
            <dd>{`${plan.dataCapacity ? plan.dataRuns.filter((r) => r.length).length : "?"} / ${plan.powerCapacity ? plan.powerRuns.filter((r) => r.length).length : "?"}`}</dd>
            <dt>Rigging load</dt>
            <dd>
              {plan.rigging
                ? c.mount === "flown"
                  ? plan.rigging.perPointKg === null
                    ? "Enter hanging points"
                    : `${plan.rigging.perPointKg.toFixed(1)} kg per point (cabinet weight only)`
                  : `${plan.rigging.onBottomCabinetKg.toFixed(1)} kg on bottom cabinet per column`
                : "Cabinet weight not specified"}
            </dd>
            <dt>Derived pitch / 20/20 acuity distance</dt>
            <dd>
              {plan.viewing
                ? `${plan.viewing.pitchMm.toFixed(3)} mm / ${plan.viewing.retinaDistanceM.toFixed(1)} m`
                : "—"}
            </dd>
          </dl>
          <p className="ws-led-help">
            Acuity distance is a geometric estimate. Rigging figures are load arithmetic, not
            structural approval.
          </p>
        </section>
        <section className="ws-card">
          <h3>Design checks</h3>
          <p>Review product and installation requirements before construction.</p>
          {plan.issues.length ? (
            <ul className="ws-led-checks">
              {plan.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p>
              Entered capacity and routing checks pass. Compatibility, wiring and site requirements
              still need verification.
            </p>
          )}
          <p className="ws-led-help">
            No receiver-card compatibility or processor configuration file is generated.
          </p>
        </section>
      </div>
      <section className="ws-card ws-led-bom">
        <div className="ws-section-heading">
          <div>
            <h3>Project BOM preview</h3>
            <p>
              Generated lines update in place. Existing manual BOM rows remain separate; review them
              for duplicate equipment.
            </p>
          </div>
        </div>
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Current BOM</th>
                <th>Planned quantity</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.description}</td>
                  <td>{p.items.find((i) => i.id === line.id)?.quantity ?? "New"}</td>
                  <td>
                    {line.quantity} {line.unit}
                  </td>
                  <td>
                    {line.unitCost === null
                      ? "Not priced"
                      : `${line.currency} ${line.unitCost.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ws-led-help">
          Generated lines no longer required are retained as excluded with zero quantity. Main
          lengths are estimates rounded to stock lengths; jumper lengths and connector types remain
          to specify.
        </p>
        <label className="ws-checkbox">
          <input
            type="checkbox"
            checked={verified === signature}
            onChange={(e) => setVerified(e.target.checked ? signature : "")}
          />
          I have checked the specifications for this layout.
        </label>
        <button
          className="ws-button primary"
          disabled={invalid || verified !== signature}
          onClick={() => {
            try {
              updateProject(applyLedBom(p));
              toast.success("LED equipment and cable quantities updated in BOM");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <ArrowRight size={15} />
          Update project BOM
        </button>
      </section>
      <section className="ws-card ws-led-saved">
        <div className="ws-section-heading">
          <div>
            <h3>Saved LED designs</h3>
            <p>
              Capture this layout, routing and a copy of the current BOM. Later edits leave saved
              designs unchanged.
            </p>
          </div>
        </div>
        <div className="ws-led-savebar">
          <label>
            LED design name
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <button
            className="ws-button"
            disabled={!l || !title.trim() || p.ledDesigns.length >= 50}
            onClick={() => {
              try {
                updateProject(saveLedDesign(p, title));
                toast.success("LED design and current BOM snapshot saved");
                setTitle(`LED design ${String(p.ledDesigns.length + 2).padStart(2, "0")}`);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Save size={15} />
            Save LED design
          </button>
        </div>
        {!p.ledDesigns.length && (
          <p className="ws-led-help">
            Update the BOM first if you want the snapshot to contain the new material quantities.
          </p>
        )}
        {p.ledDesigns.map((design) => (
          <div className="ws-led-saved-row" key={design.id}>
            <div>
              <strong>{design.title}</strong>
              <small>
                Saved BOM R{design.bomRevision} · {design.items.length} rows ·{" "}
                {new Date(design.createdAt).toLocaleString()}
              </small>
            </div>
            <button
              className="ws-button"
              onClick={() => {
                updateProject({
                  ...p,
                  led: structuredClone(design.geometry),
                  ledPlanner: structuredClone(design.config),
                });
                toast.success(
                  "Saved layout opened. Current BOM is unchanged; review the preview before updating.",
                );
              }}
            >
              Open layout
            </button>
            <button className="ws-button" disabled={exporting} onClick={() => void report(design)}>
              Export saved PDF
            </button>
            <button
              className="ws-button"
              onClick={() => {
                updateProject({ ...p, ledDesigns: p.ledDesigns.filter((d) => d.id !== design.id) });
                toast.success("Saved design removed. Undo is available.");
              }}
            >
              Remove saved design
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
