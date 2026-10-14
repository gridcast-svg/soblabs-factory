import { useEffect, useMemo, useState } from "react";
import {
  Grid2X2,
  List,
  ArrowRight,
  Search,
  SlidersHorizontal,
  Check,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import { DisplayDrawing } from "@/components/DisplayDrawing";
import { fromMm, toMm, nearestLayouts } from "@/lib/led-calc";
import type { LengthUnit } from "@/lib/led-calc";
import { useWorkspace } from "./store";
import { blankItem } from "./model";
import { Metric } from "./Bom";
import { toast } from "sonner";
import { cabinetSpec, ledProductSchema, productLayout } from "./led-products";
import type { LedLibraryProduct } from "./led-products";
import { LedProductUpload } from "./LedProductUpload";
import "./led.css";
const cardFields = [
  "Picture",
  "Pixel pitch",
  "Best-fit size",
  "Resolution",
  "Brightness",
  "Refresh rate",
  "Typical power",
  "Contrast ratio",
  "Gap to target",
] as const;
const specification = (value: number | null, unit: string) =>
  value === null ? "Not specified" : `${value.toLocaleString("en-CA")} ${unit}`;
export function Led() {
  const { state, project: p, updateProject } = useWorkspace();
  const l = p.led;
  const [step, setStep] = useState(l.product ? 3 : 1);
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState("");
  const [series, setSeries] = useState("");
  const [pitch, setPitch] = useState("");
  const [brightness, setBrightness] = useState("");
  const [refresh, setRefresh] = useState("");
  const [power, setPower] = useState("");
  const [contrast, setContrast] = useState("");
  const [group, setGroup] = useState("Series");
  const [sort, setSort] = useState("Name");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [visible, setVisible] = useState<string[]>(["Picture", "Pixel pitch", "Best-fit size"]);
  const [confirmed, setConfirmed] = useState(false);
  const [detail, setDetail] = useState<LedLibraryProduct | null>(null);
  const unit = l.unit ?? "mm";
  const mode = l.sizingMode ?? "wall";
  const hasProduct = Boolean(l.product);
  useEffect(() => {
    setStep(hasProduct ? 3 : 1);
    setDetail(null);
  }, [p.id, hasProduct]);
  useEffect(() => {
    setConfirmed(false);
  }, [
    p.id,
    l.width,
    l.height,
    l.product?.id,
    l.cabinetWidth,
    l.cabinetHeight,
    l.pixelWidth,
    l.pixelHeight,
    l.costPerSqm,
    l.sizingMode,
    l.clearanceX,
    l.clearanceY,
    l.product?.currency,
  ]);
  const demo = useMemo(
    () =>
      ledProductSchema.parse({
        id: "factory-demo-cabinet",
        manufacturer: "Fictional demonstration",
        series: "Sample cabinets",
        model: "Demo cabinet",
        widthMm: 500,
        heightMm: 500,
        pixelWidth: 250,
        pixelHeight: 250,
        pixelPitchMm: 2,
        environment: "Indoor",
        demo: true,
        source: "Fictional geometry for interface testing; not a purchasable product.",
      }),
    [],
  );
  const products = state.ledProducts?.length ? state.ledProducts : [demo];
  const selected = l.product;
  const layout = selected
    ? productLayout(selected, l.width, l.height, mode, l.clearanceX ?? 0, l.clearanceY ?? 0)
    : null;
  const size = (w: number, h: number) =>
    `${fromMm(w, unit).toFixed(unit === "mm" ? 0 : 2)} × ${fromMm(h, unit).toFixed(unit === "mm" ? 0 : 2)} ${unit}`;
  const seriesOptions = [...new Set(products.map((p) => p.series).filter(Boolean))].sort();
  const filtered = products
    .filter((product) => {
      const query = search.toLowerCase();
      return (
        [product.manufacturer, product.series, product.model, product.sku]
          .join(" ")
          .toLowerCase()
          .includes(query) &&
        (!environment || product.environment === environment) &&
        (!series || product.series === series) &&
        (!pitch || product.pixelPitchMm === Number(pitch)) &&
        (!brightness ||
          (product.brightnessNits !== null && product.brightnessNits >= Number(brightness))) &&
        (!refresh || (product.refreshHz !== null && product.refreshHz >= Number(refresh))) &&
        (!power || (product.powerTypicalW !== null && product.powerTypicalW <= Number(power))) &&
        (!contrast || product.contrast === contrast)
      );
    })
    .sort((a, b) => {
      if (sort === "Pixel pitch")
        return (a.pixelPitchMm ?? Infinity) - (b.pixelPitchMm ?? Infinity);
      if (sort === "Closest size") {
        const score = (product: LedLibraryProduct) => {
          const fit = productLayout(
            product,
            l.width,
            l.height,
            mode,
            l.clearanceX ?? 0,
            l.clearanceY ?? 0,
          );
          return fit
            ? Math.abs(fit.widthMm - l.width) / l.width +
                Math.abs(fit.heightMm - l.height) / l.height
            : Infinity;
        };
        return score(a) - score(b);
      }
      return a.model.localeCompare(b.model, undefined, { numeric: true });
    });
  const groups = new Map<string, LedLibraryProduct[]>();
  for (const product of filtered) {
    const key =
      group === "Series"
        ? product.series || "Other products"
        : group === "Manufacturer"
          ? product.manufacturer
          : "All products";
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  function choose(product: LedLibraryProduct) {
    updateProject({
      ...p,
      led: {
        ...l,
        product: { ...product },
        cabinetWidth: product.widthMm,
        cabinetHeight: product.heightMm,
        pixelWidth: product.pixelWidth,
        pixelHeight: product.pixelHeight,
        costPerSqm: product.costPerSqm,
      },
    });
    setConfirmed(false);
    setStep(3);
  }
  function updateBom() {
    if (!layout || !selected || !confirmed || layout.cabinets > 5000) return;
    const id = `led-generated-${p.id}`,
      old = p.items.find((i) => i.id === id);
    const sameCurrency = selected.currency === p.currency;
    const item = {
      ...(old ?? blankItem()),
      id,
      manufacturer: selected.demo ? "" : selected.manufacturer,
      partNumber: selected.demo ? "" : selected.model,
      sku: selected.sku,
      description: selected.demo
        ? "LED cabinets · configured display"
        : `${selected.manufacturer} ${selected.model} · configured display`,
      category: "LED",
      quantity: layout.cabinets,
      unit: "ea",
      currency: selected.currency,
      fx: sameCurrency ? 1 : old?.currency === selected.currency ? old.fx : null,
      unitCost:
        l.costPerSqm === null
          ? null
          : Math.round(
              ((((l.costPerSqm * selected.widthMm) / 1000) * selected.heightMm) / 1000) * 100,
            ) / 100,
      drawingRequired: false,
      notes: `${layout.columns} columns × ${layout.rows} rows; ${layout.widthMm} × ${layout.heightMm} mm; ${layout.pixelWidth} × ${layout.pixelHeight} pixels. Source: ${selected.source || "Not specified"}. ${selected.demo ? "Fictional demonstration. " : ""}Mounting, cabling and processing require design.`,
    };
    updateProject({
      ...p,
      items: old ? p.items.map((i) => (i.id === id ? item : i)) : [...p.items, item],
    });
    toast.success(
      sameCurrency
        ? "Cabinet quantities updated in BOM"
        : "Cabinets added. Enter the supplier exchange rate in the BOM.",
    );
  }
  const dimensions = (
    <>
      <label>
        Size mode
        <select
          aria-label="LED size mode"
          value={mode}
          onChange={(e) =>
            updateProject({ ...p, led: { ...l, sizingMode: e.target.value as "wall" | "desired" } })
          }
        >
          <option value="wall">Fit within available wall</option>
          <option value="desired">Closest to desired display size</option>
        </select>
      </label>
      <label>
        Units
        <select
          aria-label="LED dimension units"
          value={unit}
          onChange={(e) =>
            updateProject({ ...p, led: { ...l, unit: e.target.value as LengthUnit } })
          }
        >
          <option value="mm">Millimetres</option>
          <option value="m">Metres</option>
          <option value="ft">Feet (decimal)</option>
        </select>
      </label>
      {(["width", "height"] as const).map((key) => (
        <label key={key}>
          {mode === "wall" ? "Available" : "Target"} {key} ({unit})
          <input
            aria-label={`Display ${key}`}
            type="number"
            min="0.001"
            step="any"
            value={Number(fromMm(l[key], unit).toFixed(4))}
            onChange={(e) => {
              const value = toMm(Number(e.target.value), unit);
              if (value > 0 && value <= 100000)
                updateProject({ ...p, led: { ...l, [key]: value } });
            }}
          />
        </label>
      ))}
      {mode === "wall" &&
        (["clearanceX", "clearanceY"] as const).map((key) => (
          <label key={key}>
            {key === "clearanceX" ? "Side" : "Top / bottom"} clearance per edge ({unit})
            <input
              type="number"
              min="0"
              step="any"
              value={fromMm(l[key] ?? 0, unit)}
              onChange={(e) => {
                const value = toMm(Number(e.target.value), unit);
                if (value >= 0 && value <= 100000)
                  updateProject({ ...p, led: { ...l, [key]: value } });
              }}
            />
          </label>
        ))}
    </>
  );
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <div className="ws-eyebrow">DESIGN YOUR DISPLAY</div>
          <h2>LED configurator</h2>
          <p>Start with the space. Find a product. Review the exact cabinet layout.</p>
        </div>
        <div className="ws-actions">
          <LedProductUpload />
        </div>
      </div>
      <nav className="led-steps" aria-label="LED configuration steps">
        {["Setup", "Product", "Configuration"].map((label, i) => (
          <button
            key={label}
            aria-current={step === i + 1 ? "step" : undefined}
            disabled={i === 2 && !selected}
            onClick={() => setStep(i + 1)}
          >
            <span>{step > i + 1 ? <Check size={14} /> : i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      {step === 1 ? (
        <section className="led-setup ws-card">
          <div>
            <span className="ws-badge">1 · SETUP</span>
            <h3>What size display do you need?</h3>
            <p>
              Wall mode keeps every cabinet inside the available space. Desired-size mode compares
              the nearest whole-cabinet layouts.
            </p>
            <div className="ws-form-grid">{dimensions}</div>
            <button className="ws-button primary" onClick={() => setStep(2)}>
              Browse products <ArrowRight size={16} />
            </button>
          </div>
          <div className="led-target-scene">
            <div className="led-target-wall">
              <div className="led-target-display" style={{ aspectRatio: l.width / l.height }}>
                <span>
                  SOBLABS
                  <br />
                  <small>YOUR DISPLAY</small>
                </span>
              </div>
            </div>
            <strong>{size(l.width, l.height)}</strong>
            <span>{mode === "wall" ? "Available wall" : "Target display size"}</span>
          </div>
        </section>
      ) : (
        <div className="led-browser">
          <aside className="led-sidebar ws-card">
            <h3>Target display size</h3>
            <div className="led-mini-display" style={{ aspectRatio: l.width / l.height }} />
            <strong>{size(l.width, l.height)}</strong>
            <button className="ws-button" onClick={() => setStep(1)}>
              <Pencil size={14} />
              Edit size
            </button>
            {step === 2 ? (
              <>
                <h3>
                  <SlidersHorizontal size={16} />
                  Filters
                </h3>
                <details open>
                  <summary>Environment</summary>
                  <select
                    aria-label="Filter LED environment"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                  >
                    <option value="">All environments</option>
                    {["Indoor", "Outdoor", "Not specified"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </details>
                <details open>
                  <summary>Series</summary>
                  <select
                    aria-label="Filter LED series"
                    value={series}
                    onChange={(e) => setSeries(e.target.value)}
                  >
                    <option value="">All series</option>
                    {seriesOptions.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </details>
                <details>
                  <summary>Pixel pitch</summary>
                  <select
                    aria-label="Filter LED pixel pitch"
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                  >
                    <option value="">All pitches</option>
                    {[
                      ...new Set(
                        products.map((p) => p.pixelPitchMm).filter((n): n is number => n !== null),
                      ),
                    ]
                      .sort((a, b) => a - b)
                      .map((v) => (
                        <option key={v} value={v}>
                          {v} mm
                        </option>
                      ))}
                  </select>
                </details>
                <details>
                  <summary>Brightness</summary>
                  <input
                    aria-label="Minimum LED brightness"
                    type="number"
                    min="0"
                    placeholder="Minimum nits"
                    value={brightness}
                    onChange={(e) => setBrightness(e.target.value)}
                  />
                </details>
                <details>
                  <summary>Refresh rate</summary>
                  <input
                    aria-label="Minimum LED refresh rate"
                    type="number"
                    min="0"
                    placeholder="Minimum Hz"
                    value={refresh}
                    onChange={(e) => setRefresh(e.target.value)}
                  />
                </details>
                <details>
                  <summary>Typical power per cabinet</summary>
                  <input
                    aria-label="Maximum typical cabinet power"
                    type="number"
                    min="0"
                    placeholder="Maximum watts"
                    value={power}
                    onChange={(e) => setPower(e.target.value)}
                  />
                </details>
                <details>
                  <summary>Contrast ratio</summary>
                  <select
                    aria-label="Filter LED contrast ratio"
                    value={contrast}
                    onChange={(e) => setContrast(e.target.value)}
                  >
                    <option value="">All contrast ratios</option>
                    {[...new Set(products.map((p) => p.contrast).filter(Boolean))]
                      .sort()
                      .map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                  </select>
                </details>
                <button
                  className="ws-text-button"
                  onClick={() => {
                    setEnvironment("");
                    setSeries("");
                    setPitch("");
                    setBrightness("");
                    setRefresh("");
                    setPower("");
                    setContrast("");
                    setSearch("");
                  }}
                >
                  Clear filters
                </button>
                <h3>Card information</h3>
                {cardFields.map((field) => (
                  <label className="ws-checkbox" key={field}>
                    <input
                      type="checkbox"
                      checked={visible.includes(field)}
                      onChange={(e) =>
                        setVisible(
                          e.target.checked
                            ? [...visible, field]
                            : visible.filter((v) => v !== field),
                        )
                      }
                    />
                    {field}
                  </label>
                ))}
              </>
            ) : (
              <>
                <h3>Selected product</h3>
                <p>
                  {selected?.manufacturer}
                  <br />
                  <strong>{selected?.model}</strong>
                </p>
                <button className="ws-button" onClick={() => setStep(2)}>
                  <ArrowLeft size={14} />
                  Change product
                </button>
                <p className="ws-footnote">
                  Library changes do not change the saved project specification. Reselect a product
                  to apply updated specifications.
                </p>
              </>
            )}
          </aside>
          <div className="led-results">
            {step === 2 ? (
              <>
                <div className="led-search-toolbar">
                  <label className="led-search">
                    <Search size={17} />
                    <input
                      aria-label="Search LED products"
                      placeholder="Search manufacturer, series, model or SKU…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div className="led-view-toggle">
                    <button
                      className="ws-icon-button"
                      aria-label="Product card view"
                      aria-pressed={view === "cards"}
                      onClick={() => setView("cards")}
                    >
                      <Grid2X2 size={17} />
                    </button>
                    <button
                      className="ws-icon-button"
                      aria-label="Product list view"
                      aria-pressed={view === "list"}
                      onClick={() => setView("list")}
                    >
                      <List size={17} />
                    </button>
                  </div>
                  <label>
                    Group by
                    <select value={group} onChange={(e) => setGroup(e.target.value)}>
                      <option>Series</option>
                      <option>Manufacturer</option>
                      <option>None</option>
                    </select>
                  </label>
                  <label>
                    Sort by
                    <select value={sort} onChange={(e) => setSort(e.target.value)}>
                      <option>Name</option>
                      <option>Pixel pitch</option>
                      <option>Closest size</option>
                    </select>
                  </label>
                </div>
                <p className="ws-footnote">
                  {filtered.length} {filtered.length === 1 ? "product" : "products"} ·{" "}
                  {state.ledProducts?.length
                    ? "Workspace product library"
                    : "Fictional example — upload your datasheets to build the library"}
                </p>
                {[...groups].map(([name, items]) => (
                  <section className="led-product-group" key={name}>
                    <h3>{name}</h3>
                    <div className={`led-product-grid ${view === "list" ? "led-list-view" : ""}`}>
                      {items.map((product) => {
                        const fit = productLayout(
                          product,
                          l.width,
                          l.height,
                          mode,
                          l.clearanceX ?? 0,
                          l.clearanceY ?? 0,
                        );
                        const supported = fit && fit.cabinets <= 5000;
                        return (
                          <article
                            className={`led-product-card ${selected?.id === product.id ? "selected" : ""}`}
                            key={product.id}
                          >
                            {visible.includes("Picture") && (
                              <div className="led-product-picture">
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={`${product.manufacturer} ${product.model}`}
                                  />
                                ) : (
                                  <div className="led-cabinet-picture">
                                    <Grid2X2 size={44} />
                                    <span>Product image not supplied</span>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="led-card-body">
                              <p className="led-manufacturer">{product.manufacturer}</p>
                              <h4>
                                {product.model} <span className="ws-badge">{product.kind}</span>
                              </h4>
                              {product.demo && <span className="led-demo">Fictional demo</span>}
                              {visible.includes("Pixel pitch") && (
                                <p>{specification(product.pixelPitchMm, "mm pitch")}</p>
                              )}
                              {visible.includes("Best-fit size") && (
                                <p>
                                  {fit
                                    ? `${size(fit.widthMm, fit.heightMm)} · ${fit.columns} × ${fit.rows}`
                                    : "Does not fit the available wall"}
                                </p>
                              )}
                              {visible.includes("Resolution") && (
                                <p>
                                  {fit
                                    ? `${fit.pixelWidth} × ${fit.pixelHeight} pixels`
                                    : "No fitting layout"}
                                </p>
                              )}
                              {visible.includes("Brightness") && (
                                <p>{specification(product.brightnessNits, "nits")}</p>
                              )}
                              {visible.includes("Refresh rate") && (
                                <p>{specification(product.refreshHz, "Hz")}</p>
                              )}
                              {visible.includes("Typical power") && (
                                <p>
                                  {specification(
                                    fit?.powerTypicalW ?? null,
                                    "W typical display power",
                                  )}
                                </p>
                              )}
                              {visible.includes("Contrast ratio") && (
                                <p>{product.contrast || "Contrast not specified"}</p>
                              )}
                              {visible.includes("Gap to target") && (
                                <p>
                                  {fit
                                    ? `Δ width ${Math.round(fit.widthMm - l.width)} mm · Δ height ${Math.round(fit.heightMm - l.height)} mm`
                                    : "No fitting layout"}
                                </p>
                              )}
                              <div className="led-card-actions">
                                <button
                                  className="ws-text-button"
                                  onClick={() => setDetail(product)}
                                >
                                  More info
                                </button>
                                <button
                                  className="ws-button"
                                  disabled={!supported}
                                  onClick={() => choose(product)}
                                >
                                  Select product <ArrowRight size={14} />
                                </button>
                              </div>
                              {fit && !supported && (
                                <p className="crm-error">Layout exceeds 5,000 cabinets.</p>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {!filtered.length && (
                  <div className="ws-empty">
                    No products match. Clear the filters or upload a new datasheet.
                  </div>
                )}
              </>
            ) : (
              selected && (
                <>
                  {selected.demo && (
                    <p className="ws-callout">
                      Fictional demonstration product. Upload verified specifications for an actual
                      installation.
                    </p>
                  )}
                  {layout && layout.cabinets <= 5000 ? (
                    <>
                      <div className="ws-metrics compact">
                        <Metric
                          label="Cabinets"
                          value={`${layout.columns} × ${layout.rows} = ${layout.cabinets}`}
                        />
                        <Metric
                          label="Resolution"
                          value={`${layout.pixelWidth} × ${layout.pixelHeight}`}
                        />
                        <Metric
                          label="Achieved size"
                          value={size(layout.widthMm, layout.heightMm)}
                        />
                      </div>
                      <div className="ws-card led-drawing">
                        <DisplayDrawing
                          layout={layout}
                          cabinetWidthMm={selected.widthMm}
                          cabinetHeightMm={selected.heightMm}
                          cabinetDepthMm={selected.depthMm}
                          mountingDepthMm={null}
                          wallWidthMm={mode === "wall" ? l.width : null}
                          wallHeightMm={mode === "wall" ? l.height : null}
                        />
                      </div>
                      {mode === "desired" && selected.kind === "Cabinet" && (
                        <details className="ws-card led-alternatives">
                          <summary>Nearby whole-cabinet layouts</summary>
                          {nearestLayouts(cabinetSpec(selected), l.width, l.height).map(
                            (option) => (
                              <p key={`${option.layout.columns}-${option.layout.rows}`}>
                                {option.layout.columns} × {option.layout.rows} ·{" "}
                                {size(option.layout.widthMm, option.layout.heightMm)} · Δ{" "}
                                {Math.round(option.widthDeltaMm)} /{" "}
                                {Math.round(option.heightDeltaMm)} mm
                              </p>
                            ),
                          )}
                        </details>
                      )}
                      <div className="ws-card led-configuration-summary">
                        <h3>Project specification</h3>
                        <dl>
                          <div>
                            <dt>Achieved area</dt>
                            <dd>
                              {layout.areaSqm.toFixed(2)} m² / {layout.areaSqft.toFixed(2)} ft²
                            </dd>
                          </div>
                          <div>
                            <dt>Weight</dt>
                            <dd>{specification(layout.weightKg, "kg")}</dd>
                          </div>
                          <div>
                            <dt>Typical / maximum power</dt>
                            <dd>
                              {specification(layout.powerTypicalW, "W")} /{" "}
                              {specification(layout.powerMaxW, "W")}
                            </dd>
                          </div>
                          <div>
                            <dt>Specification source</dt>
                            <dd>{selected.source || "Not specified"}</dd>
                          </div>
                        </dl>
                        <label>
                          Supplier cost per m² ({selected.currency})
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={l.costPerSqm ?? ""}
                            placeholder="Not yet priced"
                            onChange={(e) => {
                              const n = e.target.value === "" ? null : Number(e.target.value);
                              if (n === null || (Number.isFinite(n) && n >= 0))
                                updateProject({ ...p, led: { ...l, costPerSqm: n } });
                            }}
                          />
                        </label>
                        <p className="ws-footnote">
                          Mounting, processing compatibility and cabling require design. Unknown
                          power and weight remain unspecified. Mixed-currency costs require an
                          exchange rate in the BOM.
                        </p>
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
                          disabled={!confirmed}
                          onClick={updateBom}
                        >
                          Update project BOM <ArrowRight size={15} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="ws-empty">
                      {layout
                        ? "Choose a layout of 5,000 cabinets or fewer."
                        : "This product does not fit the usable wall. Change the product or edit the target size."}
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}
      {detail && (
        <div className="ws-modal-backdrop">
          <section
            className="ws-modal"
            role="dialog"
            aria-modal="true"
            aria-label="LED product specifications"
          >
            <h2>
              {detail.manufacturer} · {detail.model}
            </h2>
            <p>
              {detail.environment} · {detail.kind}
            </p>
            <p>
              Cabinet: {detail.widthMm} × {detail.heightMm} mm · exact pixels {detail.pixelWidth} ×{" "}
              {detail.pixelHeight}
            </p>
            <p>
              Pitch: {specification(detail.pixelPitchMm, "mm")} · Brightness:{" "}
              {specification(detail.brightnessNits, "nits")}
            </p>
            <p>
              Typical / maximum power per cabinet: {specification(detail.powerTypicalW, "W")} /{" "}
              {specification(detail.powerMaxW, "W")}
            </p>
            <p>Source: {detail.source || "Not specified"}</p>
            {detail.datasheetUrl && (
              <a href={detail.datasheetUrl} target="_blank" rel="noopener noreferrer">
                Open manufacturer datasheet
              </a>
            )}
            <p>
              <button className="ws-button" onClick={() => setDetail(null)}>
                Close product details
              </button>
            </p>
          </section>
        </div>
      )}
    </>
  );
}
