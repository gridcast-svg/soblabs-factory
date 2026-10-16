import { useState } from "react";
import { Download, Save } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./store";
import { cableCsv, captureDrawingSet, drawingFilename, drawingProject } from "./drawing-sets";
import { drawingSvg } from "./drawing";
import { download } from "./files";
import { reconcile } from "./model";
import type { DrawingSet } from "./model";
import "./drawing-sets.css";

export function DrawingSets() {
  const { project, updateProject } = useWorkspace();
  const latest = project.drawingSets.at(-1);
  const [title, setTitle] = useState(latest?.title ?? `${project.name} system design`);
  const [number, setNumber] = useState(latest?.drawingNumber ?? "SYS-001");
  const [bomName, setBomName] = useState(latest?.bomName ?? `${project.name} BOM`);
  const [notes, setNotes] = useState("");
  const [selectedId, setSelectedId] = useState(project.drawingSets.at(-1)?.id ?? "");
  const [busy, setBusy] = useState(false);
  const selected = project.drawingSets.find((d) => d.id === selectedId);
  function save() {
    try {
      const drawing = captureDrawingSet(project, { title, drawingNumber: number, bomName, notes });
      updateProject({ ...project, drawingSets: [...project.drawingSets, drawing] });
      setSelectedId(drawing.id);
      setNotes("");
      toast.success(
        `Saved ${drawing.drawingNumber} R${drawing.drawingRevision} with ${drawing.bomName} R${drawing.bomRevision}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to save drawing revision");
    }
  }
  async function pdf(kind: "set" | "labels") {
    if (!selected) return;
    setBusy(true);
    try {
      const exports = await import("./drawing-export");
      const blob =
        kind === "set" ? await exports.drawingPdf(selected) : exports.cableLabelsPdf(selected);
      download(
        `${drawingFilename(selected)}-${kind === "set" ? "drawing-set" : "cable-labels"}.pdf`,
        blob,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ws-drawing-sets" aria-label="Drawing revisions and linked BOMs">
      <div className="ws-drawing-save">
        <h3>Drawing revisions & linked BOMs</h3>
        <p>
          Save the schematic, rack layout, cables, and their exact BOM together. Canvas edits
          continue on the working design.
        </p>
        <div className="ws-drawing-fields">
          <label>
            Drawing number
            <input maxLength={80} value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label>
            Drawing title
            <input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Linked BOM name
            <input maxLength={200} value={bomName} onChange={(e) => setBomName(e.target.value)} />
          </label>
          <label>
            Revision notes
            <input
              maxLength={4000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What changed in this revision?"
            />
          </label>
        </div>
        <button className="ws-button primary" onClick={save}>
          <Save size={15} />
          Save drawing revision
        </button>
      </div>
      <div className="ws-drawing-exports">
        <label>
          Saved drawing revision
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Choose a saved revision</option>
            {[...project.drawingSets].reverse().map((d) => (
              <option key={d.id} value={d.id}>
                {d.drawingNumber} R{d.drawingRevision} — {d.bomName} R{d.bomRevision}
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <DrawingSummary drawing={selected} />
        ) : (
          <p>
            No saved revision selected. Save the working drawing with a named BOM to export a
            coordinated set.
          </p>
        )}
        <div className="ws-actions">
          <button
            className="ws-button"
            disabled={!selected || busy}
            onClick={() => void pdf("set")}
          >
            <Download size={14} />
            {busy ? "Preparing…" : "Export PDF set"}
          </button>
          <button
            className="ws-button"
            disabled={!selected?.connections.length || busy}
            onClick={() => void pdf("labels")}
          >
            Cable labels PDF
          </button>
          <button
            className="ws-button"
            disabled={!selected}
            onClick={() =>
              selected &&
              download(
                `${drawingFilename(selected)}-cables.csv`,
                cableCsv(selected),
                "text/csv;charset=utf-8",
              )
            }
          >
            Cable schedule CSV
          </button>
          {(["schematic", "rack"] as const).map((view) => (
            <button
              className="ws-button"
              key={view}
              disabled={!selected}
              onClick={() =>
                selected &&
                download(
                  `${drawingFilename(selected)}-${view}.svg`,
                  drawingSvg(drawingProject(selected), view, selected),
                  "image/svg+xml",
                )
              }
            >
              Saved {view} SVG
            </button>
          ))}
        </div>
        {selected && (
          <details>
            <summary>Preview saved schematic</summary>
            <img
              alt={`Saved schematic ${selected.drawingNumber} revision ${selected.drawingRevision}`}
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawingSvg(drawingProject(selected), "schematic", selected))}`}
            />
          </details>
        )}
      </div>
    </section>
  );
}

function DrawingSummary({ drawing }: { drawing: DrawingSet }) {
  const issues = reconcile(drawingProject(drawing));
  return (
    <div className="ws-drawing-summary">
      <strong>
        {drawing.title} · R{drawing.drawingRevision}
      </strong>
      <p>
        Linked BOM: {drawing.bomName} · R{drawing.bomRevision} ·{" "}
        {drawing.items.filter((i) => i.scope === "Selected").length} selected lines
      </p>
      <p>
        {drawing.devices.length} devices · {drawing.connections.length} cables · saved{" "}
        {new Date(drawing.createdAt).toLocaleString()}
      </p>
      <p>
        {issues.length
          ? `Draft · ${issues.length} unresolved design checks included in the PDF`
          : "Design checks clear; technical verification still required"}
      </p>
      <small>
        Exports use this saved revision. Later BOM edits do not change it. PDF equipment lists omit
        pricing.
      </small>
    </div>
  );
}
