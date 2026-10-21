import { useEffect, useState } from "react";
import { ArrowRight, Download, Maximize2, Plus, Save, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./store";
import { Metric } from "./Bom";
import { PlannerNumberField as NumberField } from "./PlannerNumberField";
import { ProjectionEquipment } from "./ProjectionEquipment";
import {
  calculateProjection,
  applyProjectionBom,
  projectionBomLines,
  saveProjectionDesign,
  projectionArenaXml,
  importProjectionLibrary,
} from "./projection-planner";
import {
  projectionConfigSchema,
  projectionLibrarySchema,
  type ProjectionConfig,
  type ProjectionLens,
  type ProjectionLibrary,
  type ProjectionProjector,
} from "./projection-schema";
import { projectionSvg, type ProjectionView } from "./projection-drawing";
import { projectionPdf, projectionScheduleCsv } from "./projection-export";
import { fromMetres, toMetres, lengthUnit } from "@/vendor/blend-calc/lib/units";
import { download } from "./files";
import { uid, type ProjectionDesign } from "./model";
import "./led-planner.css";
import "./projection.css";

import { usePlannerTheme } from "./planner-theme";
import { epsonLibrary, epsonRoomExample, isEmptyProjection } from "./epson-catalogue";

export function Projection() {
  const { project: stored, updateProject } = useWorkspace();
  const preview = isEmptyProjection(stored);
  const p = preview ? epsonRoomExample(stored) : stored;
  const { theme, toggleTheme } = usePlannerTheme();
  const c = p.projection,
    library = p.projectionLibrary;
  const plan = calculateProjection(c, library),
    s = plan.solution;
  const [tab, setTab] = useState("Screen"),
    [view, setView] = useState<ProjectionView>("elevation");
  const [expanded, setExpanded] = useState(false),
    [zoom, setZoom] = useState(1);
  const [verified, setVerified] = useState(""),
    [name, setName] = useState("Projection design 01");
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<{
    kind: "projector" | "lens";
    initial: ProjectionProjector | ProjectionLens | null;
  } | null>(null);
  const [incoming, setIncoming] = useState<ProjectionLibrary | null>(null);
  const patch = (change: Partial<ProjectionConfig>) =>
    updateProject({ ...p, projection: { ...c, ...change } });
  const signature = JSON.stringify([p.id, c, library]);
  const unit = lengthUnit(c.units),
    lines = projectionBomLines(p);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  async function pdf(saved?: ProjectionDesign) {
    setExporting(true);
    try {
      download(`Soblabs-projection-${saved?.id ?? "current"}.pdf`, await projectionPdf(p, saved));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const distanceField = (
    key: "widthM" | "heightM" | "radiusM" | "throwDistanceM",
    label: string,
    max = 1000,
  ) => (
    <NumberField
      key={`${key}-${c.units}`}
      label={`${label} (${unit})`}
      value={fromMetres(c[key], c.units)}
      min={fromMetres(0.001, c.units)}
      max={fromMetres(max, c.units)}
      onChange={(n) => patch({ [key]: toMetres(n!, c.units) })}
    />
  );
  function saveEquipment(value: ProjectionProjector | ProjectionLens) {
    const next = structuredClone(library);
    if ("nativeWidth" in value)
      next.projectors = [...next.projectors.filter((x) => x.id !== value.id), value];
    else next.lenses = [...next.lenses.filter((x) => x.id !== value.id), value];
    updateProject({
      ...p,
      projectionLibrary: projectionLibrarySchema.parse(next),
      projection: {
        ...c,
        projectorId: c.projectorId ?? ("nativeWidth" in value ? value.id : null),
        lensId: null,
      },
    });
    setEditing(null);
    toast.success("Equipment profile saved");
  }
  function example() {
    updateProject(epsonRoomExample(stored));
  }
  function addEpsonEquipment() {
    updateProject({
      ...p,
      projectionLibrary: {
        projectors: [
          ...library.projectors,
          ...epsonLibrary.projectors.filter(
            (x) => !library.projectors.some((old) => old.id === x.id),
          ),
        ],
        lenses: [
          ...library.lenses,
          ...epsonLibrary.lenses.filter((x) => !library.lenses.some((old) => old.id === x.id)),
        ],
      },
    });
  }
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>Projection planner</h2>
          <p>Screen coverage, throw geometry, lens selection and edge blending.</p>
        </div>
        <a
          className="ws-badge"
          href="https://github.com/stoatworks-labs/blend-calc"
          target="_blank"
          rel="noreferrer"
        >
          Blend Calc · MIT
        </a>
      </div>
      {(preview || !library.projectors.length) && (
        <div className="ws-callout ws-projection-intro">
          <span>
            {preview
              ? "Epson room example · 8 × 10 × 3 m room, 4 × 2.25 m screen, 6.5 m throw. Preview only; editing or saving adopts this setup in your project."
              : "Start with the Epson room example or add your own equipment profiles."}
          </span>
          <button className="ws-button" onClick={example}>
            Use Epson room example
          </button>
        </div>
      )}
      <div className="ws-led-planner">
        <aside className="ws-led-controls ws-card">
          <div className="ws-led-tabs" role="tablist" aria-label="Projection planning controls">
            {["Screen", "Room", "Array", "Equipment", "Throw"].map((label) => (
              <button
                key={label}
                role="tab"
                aria-selected={tab === label}
                onClick={() => setTab(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={`${tab} controls`} className="ws-form-grid">
            {tab === "Room" && (
              <>
                <label className="wide ws-checkbox">
                  <input
                    type="checkbox"
                    checked={c.room !== null}
                    onChange={(e) =>
                      patch({
                        room: e.target.checked ? { widthM: 8, depthM: 10, heightM: 3 } : null,
                      })
                    }
                  />
                  Show room boundary in plan view
                </label>
                {c.room &&
                  (
                    [
                      ["widthM", "Room width"],
                      ["depthM", "Room depth"],
                      ["heightM", "Room height"],
                    ] as const
                  ).map(([key, label]) => (
                    <NumberField
                      key={`${key}-${c.units}`}
                      label={`${label} (${unit})`}
                      value={fromMetres(c.room![key], c.units)}
                      min={fromMetres(0.001, c.units)}
                      max={fromMetres(1000, c.units)}
                      onChange={(n) =>
                        patch({ room: { ...c.room!, [key]: toMetres(n!, c.units) } })
                      }
                    />
                  ))}
                <p className="ws-led-help wide">
                  Example assumes a centred screen on the front wall and on-axis projectors. Room
                  dimensions are planning assumptions; ceiling placement, obstacles, and viewing
                  positions require a site survey.
                </p>
              </>
            )}
            {tab === "Screen" && (
              <>
                <label>
                  Display units
                  <select
                    value={c.units}
                    onChange={(e) => patch({ units: e.target.value as ProjectionConfig["units"] })}
                  >
                    <option value="metric">Metres</option>
                    <option value="imperial">Feet</option>
                  </select>
                </label>
                <label>
                  Screen geometry
                  <select
                    value={c.kind}
                    onChange={(e) => patch({ kind: e.target.value as ProjectionConfig["kind"] })}
                  >
                    <option value="flat">Flat</option>
                    <option value="cylindrical">Cylindrical</option>
                  </select>
                </label>
                {distanceField("widthM", c.kind === "flat" ? "Screen width" : "Screen arc length")}
                {distanceField("heightM", "Screen height")}
                {c.kind === "cylindrical" && distanceField("radiusM", "Screen radius", 100000)}
                <NumberField
                  label="Screen gain"
                  value={c.gain}
                  max={10}
                  onChange={(n) => patch({ gain: n! })}
                />
                <label className="ws-checkbox wide">
                  <input
                    type="checkbox"
                    checked={c.includeScreen}
                    onChange={(e) => patch({ includeScreen: e.target.checked })}
                  />
                  Include screen material in generated BOM
                </label>
                <p className="ws-led-help wide">
                  Curved width is measured along the surface. Internal distances stay in metres;
                  changing display units preserves the design.
                </p>
              </>
            )}
            {tab === "Array" && (
              <>
                <NumberField
                  label="Projector columns"
                  value={c.columns}
                  min={1}
                  max={Math.min(32, Math.floor(256 / c.rows))}
                  whole
                  onChange={(n) => patch({ columns: n! })}
                />
                <NumberField
                  label="Projector rows"
                  value={c.rows}
                  min={1}
                  max={Math.min(32, Math.floor(256 / c.columns))}
                  whole
                  onChange={(n) => patch({ rows: n! })}
                />
                <label className="wide">
                  Fit mode
                  <select
                    value={c.fitMode}
                    onChange={(e) =>
                      patch({ fitMode: e.target.value as ProjectionConfig["fitMode"] })
                    }
                  >
                    <option value="fit-width">Fit width · derive vertical blend</option>
                    <option value="fit-height">Fit height · derive horizontal blend</option>
                    <option value="manual">Manual overlaps · report coverage</option>
                  </select>
                </label>
                {c.fitMode !== "fit-height" && (
                  <NumberField
                    label="Horizontal overlap (%)"
                    value={c.hOverlap * 100}
                    min={0}
                    max={50}
                    onChange={(n) => patch({ hOverlap: n! / 100 })}
                  />
                )}
                {c.fitMode !== "fit-width" && (
                  <NumberField
                    label="Vertical overlap (%)"
                    value={c.vOverlap * 100}
                    min={0}
                    max={50}
                    onChange={(n) => patch({ vOverlap: n! / 100 })}
                  />
                )}
                <p className="ws-led-help wide">
                  Overlap is a fraction of one projector image. Supported range is 0–50%. The array
                  limit is 256 projectors.
                </p>
              </>
            )}
            {tab === "Equipment" && (
              <>
                <label className="wide">
                  Planning raster
                  <select
                    aria-label="Planning raster"
                    value={c.rasterMode}
                    onChange={(e) => patch({ rasterMode: e.target.value as "native" | "display" })}
                  >
                    <option value="native">Native panel resolution</option>
                    <option value="display">Displayed resolution / pixel-shift output</option>
                  </select>
                </label>
                <p className="wide ws-led-help">
                  {plan.projector?.resolutionNote ??
                    "Native panel resolution is used when no displayed-resolution specification is available."}
                </p>
                <label className="wide">
                  Projector profile
                  <select
                    value={c.projectorId ?? ""}
                    onChange={(e) => patch({ projectorId: e.target.value || null, lensId: null })}
                  >
                    <option value="">Choose projector</option>
                    {library.projectors.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.brand} {x.model}
                        {x.verified ? "" : " · unverified"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  Lens profile
                  <select
                    value={c.lensId ?? ""}
                    onChange={(e) => patch({ lensId: e.target.value || null })}
                  >
                    <option value="">Recommend compatible lens</option>
                    {library.lenses
                      .filter((x) => x.mount === plan.projector?.mount)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                          {x.verified ? "" : " · unverified"}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="ws-button"
                  onClick={() => setEditing({ kind: "projector", initial: null })}
                >
                  <Plus size={14} />
                  Add projector
                </button>
                <button
                  className="ws-button"
                  onClick={() => setEditing({ kind: "lens", initial: null })}
                >
                  <Plus size={14} />
                  Add lens
                </button>
                <p className="ws-led-help wide">
                  Profiles are saved with this project. A matching mount family is a declared
                  relationship; verify the actual body/lens combination against its source.
                </p>
              </>
            )}
            {tab === "Throw" && (
              <>
                <label className="wide">
                  Projector placement
                  <select
                    value={c.placement}
                    onChange={(e) =>
                      patch({ placement: e.target.value as ProjectionConfig["placement"] })
                    }
                  >
                    <option value="per-tile">On axis for each tile</option>
                    <option value="common-point">Common rig / projection booth</option>
                  </select>
                </label>
                {distanceField("throwDistanceM", "Nominal throw distance")}
                <p className="ws-led-help wide">
                  Perpendicular throw determines throw ratio. For common-point arrays the schedule
                  also shows horizontal slant distance. Check vertical placement and coupled
                  lens-shift limits separately.
                </p>
              </>
            )}
          </div>
          <div className="ws-led-attribution">
            Geometry adapted from{" "}
            <a href="/licenses/blend-calc.txt" target="_blank" rel="noreferrer">
              Blend Calc (MIT)
            </a>
            .
          </div>
        </aside>
        <div className="ws-led-workarea">
          <div className="ws-metrics compact">
            <Metric label="Projectors" value={`${c.columns} × ${c.rows} = ${c.columns * c.rows}`} />
            <Metric
              label="Blended canvas"
              value={
                plan.raster
                  ? `${plan.raster.canvasWidth} × ${plan.raster.canvasHeight} px`
                  : "Enter specifications"
              }
            />
            <Metric label="Selected lens" value={plan.lens?.name ?? "No compatible lens"} />
          </div>
          <section
            className={`ws-led-stage ws-projection-stage${expanded ? " is-expanded" : ""}`}
            aria-label="Projection drawing viewer"
            data-theme={theme}
          >
            <div className="ws-led-stagebar">
              <strong>{p.name} / Projection</strong>
              <button
                className="ws-button ws-planner-theme"
                aria-label={theme === "light" ? "Switch to dark canvas" : "Switch to light canvas"}
                onClick={toggleTheme}
              >
                {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
                {theme === "light" ? "Dark canvas" : "Paper canvas"}
              </button>
              <button className="ws-button" onClick={() => setExpanded(!expanded)}>
                <Maximize2 size={14} />
                {expanded ? "Return to Factory" : "Expand projection planner"}
              </button>
            </div>
            <div className="ws-projection-viewbar">
              <button
                className={`ws-button ${view === "elevation" ? "primary" : ""}`}
                onClick={() => setView("elevation")}
              >
                Front elevation
              </button>
              <button
                className={`ws-button ${view === "plan" ? "primary" : ""}`}
                onClick={() => setView("plan")}
              >
                Plan view
              </button>
              <div className="ws-led-zoom">
                <button
                  aria-label="Zoom out projection drawing"
                  onClick={() => setZoom(Math.max(1, zoom - 0.5))}
                >
                  −
                </button>
                <button onClick={() => setZoom(1)}>Fit drawing</button>
                <button
                  aria-label="Zoom in projection drawing"
                  onClick={() => setZoom(Math.min(4, zoom + 0.5))}
                >
                  +
                </button>
              </div>
            </div>
            <div className="ws-led-canvas">
              {s ? (
                <div
                  className="ws-led-svg"
                  style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
                  dangerouslySetInnerHTML={{ __html: projectionSvg(c, plan, view, false, theme) }}
                />
              ) : (
                <div className="ws-empty">{plan.diagnostics[0]?.message}</div>
              )}
            </div>
            <div className="ws-led-stagefoot">
              <span>
                {c.kind === "cylindrical" ? "Curved screen; elevation is unwrapped" : "Flat screen"}
              </span>
              {s
                ? `H blend ${(s.hOverlap * 100).toFixed(1)}% · V blend ${(s.vOverlap * 100).toFixed(1)}%`
                : "Geometry pending"}
            </div>
          </section>
          <div className="ws-led-exportbar">
            <button className="ws-button" disabled={!s || exporting} onClick={() => void pdf()}>
              <Download size={14} />
              {exporting ? "Preparing report…" : "Export projection PDF"}
            </button>
            <button
              className="ws-button"
              disabled={!s}
              onClick={() =>
                download(
                  `projection-${view}.svg`,
                  projectionSvg(c, plan, view, true),
                  "image/svg+xml",
                )
              }
            >
              Export projection SVG
            </button>
            <button
              className="ws-button"
              disabled={!s}
              onClick={() =>
                download("projection-schedule.csv", projectionScheduleCsv(p), "text/csv")
              }
            >
              Optical schedule CSV
            </button>
            <button
              className="ws-button"
              disabled={!plan.canExportArena}
              onClick={() => {
                try {
                  download(
                    "Factory-projection-preset.xml",
                    projectionArenaXml(p),
                    "application/xml",
                  );
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Arena geometry preset
            </button>
          </div>
          <p className="ws-led-help">
            Arena preset: virtual outputs and slice geometry only. Set physical outputs, edge
            blending and warping in Arena; the export has not been round-trip tested there.
          </p>
        </div>
      </div>
      <div className="ws-led-summary-grid">
        <section className="ws-card">
          <h3>Coverage and pixel budget</h3>
          <dl className="ws-led-facts">
            <dt>Image size per projector</dt>
            <dd>
              {s ? `${s.tileWidth.toFixed(3)} × ${s.tileHeight.toFixed(3)} m` : "Not calculated"}
            </dd>
            <dt>Actual covered size</dt>
            <dd>
              {s
                ? `${s.coveredWidth.toFixed(3)} × ${s.coveredHeight.toFixed(3)} m`
                : "Not calculated"}
            </dd>
            <dt>Horizontal / vertical blend</dt>
            <dd>
              {s
                ? `${s.pixels.hBlendPixels.toFixed(1)} / ${s.pixels.vBlendPixels.toFixed(1)} px`
                : "—"}
            </dd>
            <dt>Pixels spent on overlap</dt>
            <dd>{s ? `${(s.pixels.overlapEfficiencyLoss * 100).toFixed(1)}%` : "—"}</dd>
            <dt>Nominal image luminance</dt>
            <dd>
              {plan.luminanceNits === null
                ? "Rated output unknown / not calculated"
                : `${plan.luminanceNits.toFixed(1)} nits / ${(plan.luminanceNits / 3.4262591).toFixed(1)} fL`}
            </dd>
            <dt>Curved edge height</dt>
            <dd>
              {s && c.kind === "cylindrical"
                ? `${(s.curveHeightRatio * 100).toFixed(1)}% of centre image height`
                : "Flat image"}
            </dd>
          </dl>
          <p className="ws-led-help">
            Brightness is a nominal single-image estimate after blend compensation, before optical
            losses, ageing, masking and ambient light. Curve incidence can reduce it further.
          </p>
        </section>
        <section className="ws-card">
          <h3>Design checks</h3>
          {plan.diagnostics.length ? (
            <ul className="ws-led-checks">
              {plan.diagnostics.map((d, n) => (
                <li key={`${d.code}-${n}`} className={`ws-projection-${d.severity}`}>
                  <strong>{d.severity.toUpperCase()}</strong> · {d.message}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Entered geometric checks pass. Verify installation, optical shift envelopes and site
              conditions.
            </p>
          )}
        </section>
      </div>
      <section className="ws-card ws-led-bom">
        <h3>Optical schedule</h3>
        <p>
          Positions and required lens limits. Distance ranges refer to the current image geometry;
          changing throw on a curve requires recalculation.
        </p>
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Throw ratio</th>
                <th>Perpendicular / horizontal slant</th>
                <th>H / V shift</th>
                <th>Lens zoom distance</th>
                <th>Blend edges</th>
              </tr>
            </thead>
            <tbody>
              {plan.placements.map((x) => (
                <tr key={x.tag}>
                  <td>{x.tag}</td>
                  <td>{x.requiredThrowRatio.toFixed(3)}:1</td>
                  <td>
                    {x.throwDistance.toFixed(3)} / {x.slantDistance.toFixed(3)} m
                  </td>
                  <td>
                    {x.hShiftPct.toFixed(1)} / {x.vShiftPct.toFixed(1)}%
                  </td>
                  <td>
                    {x.distanceMin?.toFixed(2) ?? "?"}–{x.distanceMax?.toFixed(2) ?? "?"} m
                  </td>
                  <td>{x.edges}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="ws-card ws-led-bom">
        <h3>Project BOM preview</h3>
        <p>
          Generated projectors, separate lenses and optional screen material. Review existing manual
          BOM rows for duplicate equipment. Mounting, processing and cables remain to specify.
        </p>
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Current BOM</th>
                <th>Planned quantity</th>
                <th>Unit cost</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((x) => (
                <tr key={x.id}>
                  <td>{x.description}</td>
                  <td>{p.items.find((i) => i.id === x.id)?.quantity ?? "New"}</td>
                  <td>
                    {x.quantity} {x.unit}
                  </td>
                  <td>
                    {x.unitCost === null ? "Not priced" : `${x.currency} ${x.unitCost.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="ws-checkbox">
          <input
            type="checkbox"
            checked={verified === signature}
            onChange={(e) => setVerified(e.target.checked ? signature : "")}
          />
          I reviewed the projection specifications, coverage and BOM quantities.
        </label>
        <button
          className="ws-button primary"
          disabled={!plan.canApplyBom || verified !== signature}
          onClick={() => {
            try {
              updateProject(applyProjectionBom(p));
              toast.success("Projection quantities updated in BOM");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <ArrowRight size={14} />
          Update projection BOM
        </button>
        <p className="ws-led-help">
          Profiles must be source-checked before BOM application. Obsolete generated rows become
          excluded; selecting an included lens avoids charging it separately.
        </p>
      </section>
      <section className="ws-card ws-led-bom">
        <div className="ws-section-heading">
          <div>
            <h3>Projector and lens library</h3>
            <p>Editable profiles for this project, captured with each saved design.</p>
            <p className="ws-led-help">
              Epson PQ series: 1920 × 1080 panels, 3840 × 2160 on screen via 4K Crystal Motion.
              Choose panel or displayed resolution under Equipment; the Epson room example uses the
              displayed 4K raster. Lens ratios are PQ-series-specific; shift limits are
              independently rated, not a coupled shift envelope.
            </p>
            <div className="ws-actions">
              <a
                className="ws-text-button"
                href="/specs/epson/EB-PQ2010W-specification.pdf"
                download
              >
                Download EB-PQ2010W specs
              </a>
              <a
                className="ws-text-button"
                href="/specs/epson/PQ-series-projectors-and-lenses.pdf"
                download
              >
                Download PQ projector & lens guide
              </a>
            </div>
          </div>
          <div className="ws-actions">
            <button className="ws-button" onClick={addEpsonEquipment}>
              Add Epson equipment
            </button>
            <button
              className="ws-button"
              onClick={() => setEditing({ kind: "projector", initial: null })}
            >
              Add projector
            </button>
            <button
              className="ws-button"
              onClick={() => setEditing({ kind: "lens", initial: null })}
            >
              Add lens
            </button>
          </div>
        </div>
        {library.projectors.map((x) => (
          <div className="ws-led-saved-row" key={x.id}>
            <div>
              <strong>
                {x.brand} {x.model}
              </strong>
              <small>
                {x.nativeWidth} × {x.nativeHeight} px · {x.lumens ?? "Unknown"} lumens · {x.mount} ·{" "}
                {x.verified ? "Source checked" : "UNVERIFIED"}
              </small>
            </div>
            <button
              className="ws-button"
              onClick={() => setEditing({ kind: "projector", initial: x })}
            >
              Edit {x.model}
            </button>
            <button
              className="ws-button"
              onClick={() =>
                updateProject({
                  ...p,
                  projectionLibrary: {
                    ...library,
                    projectors: library.projectors.filter((a) => a.id !== x.id),
                  },
                  projection:
                    c.projectorId === x.id ? { ...c, projectorId: null, lensId: null } : c,
                })
              }
            >
              Remove {x.model}
            </button>
          </div>
        ))}
        {library.lenses.map((x) => (
          <div className="ws-led-saved-row" key={x.id}>
            <div>
              <strong>{x.name}</strong>
              <small>
                {x.throwRatioMin}–{x.throwRatioMax}:1 · {x.mount} ·{" "}
                {x.verified ? "Source checked" : "UNVERIFIED"}
              </small>
            </div>
            <button className="ws-button" onClick={() => setEditing({ kind: "lens", initial: x })}>
              Edit {x.name}
            </button>
            <button
              className="ws-button"
              onClick={() =>
                updateProject({
                  ...p,
                  projectionLibrary: {
                    ...library,
                    lenses: library.lenses.filter((a) => a.id !== x.id),
                  },
                  projection: c.lensId === x.id ? { ...c, lensId: null } : c,
                })
              }
            >
              Remove {x.name}
            </button>
          </div>
        ))}
        <div className="ws-led-exportbar">
          <button
            className="ws-button"
            onClick={() =>
              download("Factory-projection-library.json", JSON.stringify(library, null, 2))
            }
          >
            Export equipment library
          </button>
          <label className="ws-button">
            Import equipment library
            <input
              hidden
              type="file"
              accept=".json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 2 * 1024 * 1024)
                    throw new Error("Use a library file smaller than 2 MB.");
                  setIncoming(projectionLibrarySchema.parse(JSON.parse(await file.text())));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Invalid library");
                }
              }}
            />
          </label>
        </div>
      </section>
      <section className="ws-card ws-led-saved">
        <h3>Saved projection designs</h3>
        <p>
          Capture specifications, the equipment library and a copy of the current BOM. Update the
          BOM first to capture planned quantities.
        </p>
        <div className="ws-led-savebar">
          <label>
            Projection design name
            <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            className="ws-button"
            disabled={!s || !name.trim() || p.projectionDesigns.length >= 50}
            onClick={() => {
              try {
                updateProject(saveProjectionDesign(p, name));
                toast.success("Projection design and BOM snapshot saved");
                setName(
                  `Projection design ${String(p.projectionDesigns.length + 2).padStart(2, "0")}`,
                );
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Save size={14} />
            Save projection design
          </button>
        </div>
        {p.projectionDesigns.map((d) => (
          <div className="ws-led-saved-row" key={d.id}>
            <div>
              <strong>{d.title}</strong>
              <small>
                Projection BOM snapshot R{d.bomRevision} · {d.items.length} rows ·{" "}
                {new Date(d.createdAt).toLocaleString()}
              </small>
            </div>
            <button
              className="ws-button"
              onClick={() => {
                updateProject({
                  ...p,
                  projection: structuredClone(d.config),
                  projectionLibrary: structuredClone(d.library),
                });
                toast.success(
                  "Saved layout and library opened; current BOM unchanged. Undo is available.",
                );
              }}
            >
              Open projection layout
            </button>
            <button className="ws-button" disabled={exporting} onClick={() => void pdf(d)}>
              Export saved projection PDF
            </button>
            <button
              className="ws-button"
              onClick={() =>
                updateProject({
                  ...p,
                  projectionDesigns: p.projectionDesigns.filter((a) => a.id !== d.id),
                })
              }
            >
              Remove saved projection
            </button>
          </div>
        ))}
      </section>
      {editing && (
        <ProjectionEquipment
          key={editing.initial?.id ?? editing.kind}
          kind={editing.kind}
          initial={editing.initial}
          mount={plan.projector?.mount ?? ""}
          close={() => setEditing(null)}
          save={saveEquipment}
        />
      )}
      {incoming && (
        <div className="ws-modal-backdrop">
          <div
            className="ws-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review projection library import"
          >
            <h2>Review projection library import</h2>
            <p>
              Add {incoming.projectors.length} projector profiles and {incoming.lenses.length}{" "}
              lenses. Imported profiles receive new IDs and require source verification. Existing
              profiles remain unchanged; mount-family names are retained.
            </p>
            <div className="ws-actions">
              <button className="ws-button" onClick={() => setIncoming(null)}>
                Cancel import
              </button>
              <button
                className="ws-button primary"
                onClick={() => {
                  try {
                    updateProject({
                      ...p,
                      projectionLibrary: importProjectionLibrary(library, incoming),
                    });
                    setIncoming(null);
                    toast.success("Equipment profiles imported for review");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Apply library import
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
