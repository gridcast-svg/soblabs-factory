import { useState } from "react";
import { X, Upload, FileDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./store";
import { download, readPdf } from "./files";
import {
  ledProductSchema,
  ledImportFields,
  pdfSpecDraft,
  readLedProducts,
  upsertLedProducts,
  productIdentity,
} from "./led-products";
import type { LedLibraryProduct } from "./led-products";
const required = new Set([
  "manufacturer",
  "model",
  "widthMm",
  "heightMm",
  "pixelWidth",
  "pixelHeight",
]);
const numeric = new Set([
  "pixelPitchMm",
  "widthMm",
  "heightMm",
  "depthMm",
  "pixelWidth",
  "pixelHeight",
  "brightnessNits",
  "refreshHz",
  "powerTypicalW",
  "powerMaxW",
  "weightKg",
  "costPerSqm",
]);
export function LedProductUpload() {
  const { state, setState } = useWorkspace();
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [products, setProducts] = useState<LedLibraryProduct[] | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function close() {
    setDraft(null);
    setProducts(null);
    setReviewed(false);
    setError("");
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setReviewed(false);
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Use a datasheet PDF of 5 MB or smaller.");
        const text = await readPdf(file);
        if (text.length > 80000)
          throw new Error("Use a shorter datasheet with fewer than 80,000 text characters.");
        setDraft(pdfSpecDraft(text, file.name));
      } else {
        setProducts(await readLedProducts(file));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to read specifications");
    } finally {
      setBusy(false);
    }
  }
  function save(incoming: LedLibraryProduct[]) {
    try {
      setState({
        ...state,
        ledProducts: upsertLedProducts(
          state.ledProducts ?? [],
          incoming.map((p) => ({ ...p, verifiedAt: new Date().toISOString() })),
        ),
      });
      close();
      toast.success("Product specifications saved to your workspace library");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save products");
    }
  }
  async function image(file: File | undefined) {
    if (!file || !draft) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 200000) {
      setError("Use a PNG, JPEG or WebP image of 200 KB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setDraft((current) => (current ? { ...current, image: reader.result } : current));
    reader.readAsDataURL(file);
  }
  return (
    <>
      <label className="ws-button">
        <Upload size={15} />
        {busy ? "Reading datasheet…" : "Upload specifications"}
        <input
          type="file"
          accept=".pdf,.csv,.xlsx,.json"
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
        onClick={() => {
          close();
          setDraft({});
        }}
      >
        <Plus size={15} />
        Add product
      </button>
      <button
        className="ws-button"
        onClick={() =>
          download(
            "factory-led-products-template.csv",
            ledImportFields.map(([, label]) => `"${label}"`).join(",") + "\n",
            "text/csv",
          )
        }
      >
        <FileDown size={15} />
        Spreadsheet template
      </button>
      {(draft || products) && (
        <div className="ws-modal-backdrop">
          <div
            className="ws-modal led-upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="led-upload-title"
          >
            <div className="ws-section-heading">
              <div>
                <h2 id="led-upload-title">Review LED specifications</h2>
                <p>One record per cabinet size and exact pixel-resolution variant.</p>
              </div>
              <button
                className="ws-icon-button"
                aria-label="Close specification upload"
                onClick={close}
              >
                <X />
              </button>
            </div>
            {error && (
              <p role="alert" className="crm-error">
                {error}
              </p>
            )}
            {draft ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reviewed) return;
                  const parsed = ledProductSchema.safeParse({ ...draft, id: crypto.randomUUID() });
                  if (!parsed.success) {
                    setError(
                      parsed.error.issues
                        .map((i) => `${i.path.join(".")}: ${i.message}`)
                        .join("; "),
                    );
                    return;
                  }
                  save([parsed.data]);
                }}
              >
                <p className="ws-callout">
                  Check every prefilled value against the datasheet. Multi-model tables require
                  separate variants. Exact cabinet pixels are required; Factory never derives them
                  from rounded pitch. Unknown optional values remain blank.
                </p>
                <div className={draft["sourceText"] ? "led-source-review" : ""}>
                  {typeof draft["sourceText"] === "string" && (
                    <section>
                      <h3>Datasheet text · {String(draft["source"] ?? "")}</h3>
                      <pre>{draft["sourceText"]}</pre>
                    </section>
                  )}
                  <div>
                    <div className="ws-form-grid">
                      {ledImportFields.map(([key, label]) => (
                        <label key={key}>
                          {label}
                          {required.has(key) ? " *" : ""}
                          {key === "kind" || key === "environment" || key === "currency" ? (
                            <select
                              value={String(
                                draft[key] ??
                                  (key === "kind"
                                    ? "Cabinet"
                                    : key === "environment"
                                      ? "Not specified"
                                      : "CAD"),
                              )}
                              onChange={(e) => {
                                setDraft({ ...draft, [key]: e.target.value });
                                setReviewed(false);
                              }}
                            >
                              {(key === "kind"
                                ? ["Cabinet", "All-in-one"]
                                : key === "environment"
                                  ? ["Not specified", "Indoor", "Outdoor"]
                                  : ["CAD", "USD"]
                              ).map((value) => (
                                <option key={value}>{value}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              required={required.has(key)}
                              type={numeric.has(key) ? "number" : "text"}
                              min={
                                numeric.has(key)
                                  ? key === "costPerSqm"
                                    ? 0
                                    : key === "pixelWidth" || key === "pixelHeight"
                                      ? 1
                                      : 0.00001
                                  : undefined
                              }
                              step={key === "pixelWidth" || key === "pixelHeight" ? "1" : "any"}
                              value={String(draft[key] ?? "")}
                              onChange={(e) => {
                                setDraft({
                                  ...draft,
                                  [key]: numeric.has(key)
                                    ? e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value)
                                    : e.target.value,
                                });
                                setReviewed(false);
                              }}
                            />
                          )}
                        </label>
                      ))}
                      <label>
                        Product picture (optional)
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => void image(e.target.files?.[0])}
                        />
                      </label>
                    </div>
                    {typeof draft["image"] === "string" && draft["image"] && (
                      <img
                        className="led-image-preview"
                        src={draft["image"]}
                        alt="Uploaded product"
                      />
                    )}
                    <label className="ws-checkbox">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                      />
                      I reviewed this product against its specification source.
                    </label>
                    <button className="ws-button primary" disabled={!reviewed}>
                      Save product specifications
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <>
                <p>
                  Review {products!.length} variants. Matching manufacturer, model and SKU updates
                  the library record. Saved project specifications stay unchanged.
                </p>
                <div className="ws-table-wrap">
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Product</th>
                        <th>Cabinet</th>
                        <th>Exact pixels</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products!.map((p, i) => (
                        <tr key={i}>
                          <td>
                            {(state.ledProducts ?? []).some(
                              (old) => productIdentity(old) === productIdentity(p),
                            )
                              ? "Update"
                              : "Add"}
                          </td>
                          <td>
                            {p.manufacturer} · {p.model}
                          </td>
                          <td>
                            {p.widthMm} × {p.heightMm} mm
                          </td>
                          <td>
                            {p.pixelWidth} × {p.pixelHeight}
                          </td>
                          <td>{p.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="ws-checkbox">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  I reviewed all variants against their specification sources.
                </label>
                <button
                  className="ws-button primary"
                  disabled={!reviewed}
                  onClick={() => save(products!)}
                >
                  Apply product import
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
