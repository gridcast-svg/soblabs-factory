import { useState } from "react";
import { Plus, Upload, Download, Search, Trash2, X, Check } from "lucide-react";
import { blankItem, removeItem, linePrice, totals } from "./model";
import type { BomItem } from "./model";
import { useWorkspace } from "./store";
import { exportBom, mergeItems, readBom } from "./files";
import type { ImportResult } from "./files";
import { toast } from "sonner";
import { formatMoney } from "./format";
export function Bom() {
  const { project: p, updateProject } = useWorkspace();
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<BomItem | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      setPreview(await readBom(f));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  const t = totals(p);
  const filtered = p.items.filter((i) =>
    `${i.description} ${i.area} ${i.sku} ${i.partNumber}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>Bill of materials</h2>
          <p>One source for design, pricing, and purchasing.</p>
        </div>
        <div className="ws-actions">
          <a className="ws-button" href="/Soblabs-BOM-Template-v1.xlsx" download>
            Template
          </a>
          <label className="ws-button">
            <Upload size={15} />
            {busy ? "Reading…" : "Import XLSX"}
            <input
              type="file"
              accept=".xlsx"
              hidden
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="ws-button"
            onClick={() => void exportBom(p).catch((e) => toast.error(e.message))}
          >
            <Download size={15} />
            Export
          </button>
          <button className="ws-button primary" onClick={() => setEdit(blankItem())}>
            <Plus size={15} />
            Add item
          </button>
        </div>
      </div>
      <div className="ws-metrics">
        <Metric label="Selected cost" value={formatMoney(t.cost, p.currency)} />
        <Metric label="Selling subtotal" value={formatMoney(t.sell, p.currency)} />
        <Metric label="Gross profit" value={formatMoney(t.profit, p.currency)} />
        <Metric
          label="Pricing readiness"
          value={t.incomplete ? `${t.incomplete} incomplete` : "Inputs complete"}
        />
      </div>
      <div className="ws-toolbar">
        <Search size={16} />
        <input
          aria-label="Search BOM"
          placeholder="Search equipment, area, or distributor SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>
          {p.items.length} items · Revision {p.revision}
        </span>
      </div>
      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr>
              <th>Component / Area</th>
              <th>Scope</th>
              <th>Qty / Unit</th>
              <th>Supplier</th>
              <th>Unit cost</th>
              <th>Markup</th>
              <th>Extended sell</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const price = linePrice(i, p.currency);
              return (
                <tr key={i.id}>
                  <td>
                    <button className="ws-text-button" onClick={() => setEdit(i)}>
                      {i.description}
                    </button>
                    <small>
                      {i.area} · {i.partNumber || "Part number not set"}
                    </small>
                  </td>
                  <td>
                    <span className={`ws-badge ${i.scope === "Selected" ? "mint" : ""}`}>
                      {i.scope}
                    </span>
                  </td>
                  <td>
                    {i.quantity} <small className="inline">{i.unit}</small>
                  </td>
                  <td>
                    {i.supplier || "—"}
                    <small>{i.sku}</small>
                  </td>
                  <td>
                    {i.unitCost === null ? (
                      <span className="ws-warning">Not priced</span>
                    ) : (
                      formatMoney(i.unitCost, i.currency)
                    )}
                  </td>
                  <td>{i.markup}%</td>
                  <td>{price ? formatMoney(price.sell, p.currency) : "Incomplete"}</td>
                  <td>
                    <button
                      className="ws-icon-button"
                      aria-label={`Remove ${i.description}`}
                      onClick={() => {
                        if (confirm("Remove this item and its drawing instances?"))
                          updateProject(removeItem(p, i.id));
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="ws-empty">
            Add equipment, import a workbook, or generate cabinets in the LED configurator.
          </div>
        )}
      </div>
      <div className="ws-footnote">
        Totals include selected, priced items only. Tax: {formatMoney(t.tax, p.currency)} · Total:{" "}
        {formatMoney(t.total, p.currency)}.{" "}
        {t.incomplete > 0 && "Complete missing costs / exchange rates before issuing pricing."}
      </div>
      {!!p.drawingSets.length && (
        <section className="ws-card ws-spaced" aria-label="Drawings linked to BOMs">
          <h3>Drawings linked to BOMs</h3>
          <p>
            Saved revisions retain their original BOM. Open System designer to preview or export
            them.
          </p>
          {[...p.drawingSets].reverse().map((drawing) => (
            <p key={drawing.id}>
              <strong>
                {drawing.drawingNumber} R{drawing.drawingRevision}
              </strong>{" "}
              · {drawing.title} · {drawing.bomName} R{drawing.bomRevision}
            </p>
          ))}
        </section>
      )}
      {edit && (
        <ItemEditor
          item={edit}
          projectCurrency={p.currency}
          onClose={() => setEdit(null)}
          onSave={(i) => {
            updateProject({
              ...p,
              items: p.items.some((x) => x.id === i.id)
                ? p.items.map((x) => (x.id === i.id ? i : x))
                : [...p.items, i],
            });
            setEdit(null);
          }}
        />
      )}
      {preview && (
        <div className="ws-modal-backdrop">
          <div className="ws-modal">
            <div className="ws-section-heading">
              <h2>Review workbook import</h2>
              <button
                className="ws-icon-button"
                aria-label="Close import"
                onClick={() => setPreview(null)}
              >
                <X />
              </button>
            </div>
            <p>
              Into {p.name}: {preview.items.length} items from {preview.sourceSheets.join(", ")}
            </p>
            {preview.warnings.map((w) => (
              <p className="ws-callout" key={w}>
                {w}
              </p>
            ))}
            <p>
              Matching Item IDs update existing rows; new IDs add rows. Items absent from the file
              are retained. Drawing ports and rack specifications are preserved.
            </p>
            <div className="ws-import-preview">
              {preview.items.map((i) => {
                const old = p.items.find((x) => x.id === i.id);
                return (
                  <div key={i.id}>
                    <span>
                      {old ? "Update" : "Add"} · {i.area}
                    </span>
                    <strong>{i.description}</strong>
                    <span>
                      {old ? `${old.quantity} → ${i.quantity}` : i.quantity} {i.unit}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              className="ws-button primary"
              onClick={() => {
                updateProject({
                  ...p,
                  revision: p.revision + 1,
                  items: mergeItems(p.items, preview.items),
                });
                setPreview(null);
                toast.success("Workbook imported");
              }}
            >
              <Check size={16} />
              Apply import
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ws-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function ItemEditor({
  item,
  projectCurrency,
  onClose,
  onSave,
}: {
  item: BomItem;
  projectCurrency: string;
  onClose: () => void;
  onSave: (i: BomItem) => void;
}) {
  const [i, set] = useState(item);
  const field = (k: keyof BomItem, v: unknown) => set({ ...i, [k]: v });
  const numeric = (s: string) => (s === "" ? null : Number(s));
  return (
    <div className="ws-modal-backdrop">
      <form
        className="ws-modal"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(i);
        }}
      >
        <div className="ws-section-heading">
          <h2>Component details</h2>
          <button
            type="button"
            className="ws-icon-button"
            aria-label="Close component editor"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="ws-form-grid">
          {(
            [
              "description",
              "area",
              "manufacturer",
              "partNumber",
              "supplier",
              "sku",
              "unit",
            ] as const
          ).map((k) => (
            <label key={k}>
              {
                {
                  description: "Description",
                  area: "Area / System",
                  manufacturer: "Manufacturer",
                  partNumber: "Manufacturer part number",
                  supplier: "Supplier",
                  sku: "Supplier SKU",
                  unit: "Quantity unit",
                }[k]
              }
              <input
                required={k === "description" || k === "unit"}
                value={i[k]}
                onChange={(e) => field(k, e.target.value)}
              />
            </label>
          ))}
          <label>
            Category
            <select value={i.category} onChange={(e) => field("category", e.target.value)}>
              {[
                "Equipment",
                "LED",
                "Processing",
                "Computing",
                "Networking",
                "Power",
                "Rack",
                "Cabling",
                "Mounting",
                "Audio",
                "Labour",
                "Freight",
                "Spares",
                "Other",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Scope
            <select value={i.scope} onChange={(e) => field("scope", e.target.value)}>
              {["Selected", "Alternative", "Excluded"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input
              type="number"
              min="0"
              step="any"
              required
              value={i.quantity}
              onChange={(e) => field("quantity", Number(e.target.value))}
            />
          </label>
          <label>
            Unit cost
            <input
              type="number"
              min="0"
              step="any"
              value={i.unitCost ?? ""}
              placeholder="Unknown"
              onChange={(e) => field("unitCost", numeric(e.target.value))}
            />
          </label>
          <label>
            Cost currency
            <select
              value={i.currency}
              onChange={(e) => {
                const currency = e.target.value;
                set({
                  ...i,
                  currency: currency as "CAD" | "USD",
                  fx: currency === projectCurrency ? 1 : null,
                });
              }}
            >
              <option>CAD</option>
              <option>USD</option>
            </select>
          </label>
          <label>
            FX · {projectCurrency} per 1 {i.currency}
            <input
              type="number"
              min="0.000001"
              step="any"
              value={i.fx ?? ""}
              disabled={i.currency === projectCurrency}
              onChange={(e) => field("fx", numeric(e.target.value))}
            />
          </label>
          <label>
            Markup %
            <input
              type="number"
              min="0"
              step="any"
              required
              value={i.markup}
              onChange={(e) => field("markup", Number(e.target.value))}
            />
          </label>
          <label>
            Rack height (U)
            <input
              type="number"
              min="0"
              max="42"
              required
              value={i.rackU}
              onChange={(e) => field("rackU", Number(e.target.value))}
            />
          </label>
          <label>
            Lead time (days)
            <input
              type="number"
              min="0"
              value={i.leadDays ?? ""}
              onChange={(e) => field("leadDays", numeric(e.target.value))}
            />
          </label>
          <label className="ws-checkbox">
            <input
              type="checkbox"
              checked={i.taxable}
              onChange={(e) => field("taxable", e.target.checked)}
            />
            Taxable
          </label>
          <label className="ws-checkbox">
            <input
              type="checkbox"
              checked={i.drawingRequired}
              onChange={(e) => field("drawingRequired", e.target.checked)}
            />
            Reconcile with drawings
          </label>
          <label className="wide">
            Notes
            <textarea value={i.notes} onChange={(e) => field("notes", e.target.value)} />
          </label>
        </div>
        <p className="ws-footnote">
          Define equipment ports in the schematic inspector. Markup is applied to cost; 25% markup
          equals 20% gross margin.
        </p>
        <button className="ws-button primary" type="submit">
          Save component
        </button>
      </form>
    </div>
  );
}
