import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { DisplayDrawing } from "@/components/DisplayDrawing";
import { buildQuotePdf, type BusinessSettings } from "@/lib/pdf";
import { STATUS_STYLES } from "@/lib/quotes";
import {
  buildLayout,
  convert,
  fitToWall,
  formatMoney,
  formatNumber,
  marginToMarkup,
  markupToMargin,
  nearestLayouts,
  priceQuote,
  round2,
  toMm,
  type Currency,
  type LengthUnit,
  type LineItemInput,
  type PricingMode,
} from "@/lib/led-calc";
import {
  CATEGORY_LABELS,
  defaultConfig,
  type Hardware,
  type LedProduct,
  type Quote,
  type QuoteConfig,
  type QuoteItemRow,
} from "@/lib/types";
import { groupLedProducts } from "@/lib/catalogue-groups";

export const Route = createFileRoute("/_authenticated/quotes/$quoteId")({
  head: () => ({
    meta: [
      { title: "Display Configurator — Soblabs LED Configurator" },
      {
        name: "description",
        content: "Configure an LED display, review the drawing and price the quote in real time.",
      },
      { property: "og:title", content: "Display Configurator — Soblabs" },
      { property: "og:description", content: "Size, draw and price an LED display quote." },
    ],
  }),
  component: Configurator,
});

const MANUAL_CATEGORIES = ["mounting", "installation", "spares", "freight", "other"] as const;

function Configurator() {
  const { quoteId } = Route.useParams();
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItemRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      const [{ data: q, error: qErr }, { data: its, error: iErr }] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle(),
        supabase.from("quote_items").select("*").eq("quote_id", quoteId).order("sort_order"),
      ]);
      if (qErr) throw qErr;
      if (iErr) throw iErr;
      if (!q) throw new Error("Quote not found, or you do not have access to it.");
      return { quote: q as unknown as Quote, items: (its ?? []) as unknown as QuoteItemRow[] };
    },
  });

  useEffect(() => {
    if (data && !loaded.current) {
      loaded.current = true;
      setQuote({ ...data.quote, config: { ...defaultConfig, ...(data.quote.config ?? {}) } });
      setItems(data.items);
    }
  }, [data]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const catalogue = useQuery({
    queryKey: ["catalogue"],
    queryFn: async () => {
      const [products, receivers, processors, ledRx, rxProc, settings] = await Promise.all([
        supabase
          .from("led_products")
          .select("*, manufacturers(name)")
          .eq("status", "active")
          .order("model"),
        supabase.from("receiver_cards").select("*").eq("status", "active").order("model"),
        supabase.from("processors").select("*").eq("status", "active").order("model"),
        supabase.from("led_receiver_compat").select("*"),
        supabase.from("receiver_processor_compat").select("*"),
        supabase.from("business_settings").select("*").maybeSingle(),
      ]);
      return {
        products: (products.data ?? []) as unknown as LedProduct[],
        receivers: (receivers.data ?? []) as unknown as Hardware[],
        processors: (processors.data ?? []) as unknown as Hardware[],
        ledRx: (ledRx.data ?? []) as {
          led_product_id: string;
          receiver_card_id: string;
          verified: boolean;
        }[],
        rxProc: (rxProc.data ?? []) as {
          receiver_card_id: string;
          processor_id: string;
          verified: boolean;
        }[],
        settings: (settings.data ?? null) as unknown as
          (BusinessSettings & { default_exchange_rate: number }) | null,
      };
    },
  });
  const cat = catalogue.data;
  const productGroups = useMemo(() => groupLedProducts(cat?.products ?? []), [cat?.products]);

  if (isLoading || !quote) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ? (error as Error).message : "Loading quote…"}
      </p>
    );
  }

  const cfg = quote.config;
  const product = cat?.products.find((p) => p.id === cfg.ledProductId) ?? null;

  const compatibleReceivers =
    cat && product
      ? cat.receivers.filter((r) =>
          cat.ledRx.some((c) => c.led_product_id === product.id && c.receiver_card_id === r.id),
        )
      : [];
  const receiver = cat?.receivers.find((r) => r.id === cfg.receiverCardId) ?? null;
  const compatibleProcessors =
    cat && receiver
      ? cat.processors.filter((p) =>
          cat.rxProc.some((c) => c.receiver_card_id === receiver.id && c.processor_id === p.id),
        )
      : [];
  const processor = cat?.processors.find((p) => p.id === cfg.processorId) ?? null;

  function update(patch: Partial<Quote>) {
    setQuote((q) => (q ? { ...q, ...patch } : q));
    setDirty(true);
  }
  function updateConfig(patch: Partial<QuoteConfig>) {
    setQuote((q) => (q ? { ...q, config: { ...q.config, ...patch } } : q));
    setDirty(true);
  }

  // ----- geometry ----------------------------------------------------------
  const cabSpec = product
    ? {
        widthMm: Number(product.cabinet_width_mm),
        heightMm: Number(product.cabinet_height_mm),
        depthMm: product.cabinet_depth_mm != null ? Number(product.cabinet_depth_mm) : null,
        pixelWidth: product.cabinet_pixel_width,
        pixelHeight: product.cabinet_pixel_height,
        weightKg: product.cabinet_weight_kg != null ? Number(product.cabinet_weight_kg) : null,
        powerTypicalW: product.power_typical_w != null ? Number(product.power_typical_w) : null,
        powerMaxW: product.power_max_w != null ? Number(product.power_max_w) : null,
      }
    : null;

  const wallWidthMm = toMm(cfg.wallWidth, cfg.unit);
  const wallHeightMm = toMm(cfg.wallHeight, cfg.unit);
  const targetWidthMm = toMm(cfg.targetWidth, cfg.unit);
  const targetHeightMm = toMm(cfg.targetHeight, cfg.unit);

  const wallFit = cabSpec
    ? fitToWall(
        cabSpec,
        wallWidthMm,
        wallHeightMm,
        toMm(cfg.clearanceX, cfg.unit),
        toMm(cfg.clearanceY, cfg.unit),
      )
    : null;
  const options =
    cabSpec && cfg.mode === "desired" ? nearestLayouts(cabSpec, targetWidthMm, targetHeightMm) : [];

  const suggested = cfg.mode === "wall" ? (wallFit?.layout ?? null) : (options[0]?.layout ?? null);
  const cols = cfg.columns > 0 ? cfg.columns : (suggested?.columns ?? 0);
  const rows = cfg.rows > 0 ? cfg.rows : (suggested?.rows ?? 0);
  const layout = cabSpec && cols > 0 && rows > 0 ? buildLayout(cabSpec, cols, rows) : null;

  const exceedsWall =
    cfg.mode === "wall" && layout && wallFit
      ? layout.widthMm > wallFit.usableWidthMm + 0.001 ||
        layout.heightMm > wallFit.usableHeightMm + 0.001
      : false;

  // ----- pricing lines -----------------------------------------------------
  const rate = quote.exchange_rate != null ? Number(quote.exchange_rate) : null;
  const derived: LineItemInput[] = [];
  if (product && layout) {
    derived.push({
      category: "led",
      description: `${product.manufacturers?.name ?? ""} ${product.model} — ${layout.cabinets} cabinets (${formatNumber(layout.areaSqm)} m²)`,
      quantity: round2(layout.areaSqm),
      unit_cost: Number(product.supplier_cost_per_sqm ?? 0),
      cost_currency: product.supplier_currency as Currency,
      taxable: true,
      markup_override: null,
      margin_override: null,
      included_in_led: false,
    });
    if (receiver) {
      derived.push({
        category: "receiver",
        description: `${receiver.manufacturer_name ?? ""} ${receiver.model} receiver cards (${product.receiver_cards_per_cabinet} per cabinet)`,
        quantity: layout.cabinets * product.receiver_cards_per_cabinet,
        unit_cost: Number(receiver.cost ?? 0),
        cost_currency: receiver.cost_currency as Currency,
        taxable: true,
        markup_override: null,
        margin_override: null,
        included_in_led: product.receiver_card_included,
      });
    }
    if (processor && !product.integrated_processing) {
      derived.push({
        category: "processor",
        description: `${processor.manufacturer_name ?? ""} ${processor.model} processor`,
        quantity: cfg.processorQty,
        unit_cost: Number(processor.cost ?? 0),
        cost_currency: processor.cost_currency as Currency,
        taxable: true,
        markup_override: null,
        margin_override: null,
        included_in_led: false,
      });
    }
  }

  const manual: LineItemInput[] = items.map((i) => ({
    id: i.id,
    category: i.category,
    description: i.description,
    quantity: Number(i.quantity),
    unit_cost: Number(i.unit_cost),
    cost_currency: i.cost_currency as Currency,
    taxable: i.taxable,
    markup_override: i.markup_override != null ? Number(i.markup_override) : null,
    margin_override: i.margin_override != null ? Number(i.margin_override) : null,
    included_in_led: i.included_in_led,
    freight_mode: i.freight_mode,
    sort_order: i.sort_order,
  }));

  let totals: ReturnType<typeof priceQuote> | null = null;
  let pricingError: string | null = null;
  try {
    totals = priceQuote({
      items: [...derived, ...manual],
      quoteCurrency: quote.currency as Currency,
      usdToCad: rate,
      mode: quote.pricing_mode as PricingMode,
      markupPct: Number(quote.markup_pct),
      marginPct: Number(quote.margin_pct),
      taxRate: Number(quote.tax_rate),
      areaSqm: layout?.areaSqm ?? null,
    });
  } catch (e) {
    pricingError = (e as Error).message;
  }

  // ----- capacity validation ----------------------------------------------
  const validation: string[] = [];
  if (layout && product) {
    const perCabinetPixels = product.cabinet_pixel_width * product.cabinet_pixel_height;
    if (receiver?.max_pixels) {
      const capacity = receiver.max_pixels * product.receiver_cards_per_cabinet;
      validation.push(
        capacity >= perCabinetPixels
          ? `Receiver capacity ${capacity.toLocaleString()} px ≥ ${perCabinetPixels.toLocaleString()} px per cabinet. Total pixel capacity alone does not establish full compatibility.`
          : `Receiver capacity ${capacity.toLocaleString()} px is below the ${perCabinetPixels.toLocaleString()} px per cabinet.`,
      );
    } else if (receiver) {
      validation.push("Receiver card capacity data incomplete — technical verification required.");
    }
    if (processor?.max_pixels) {
      const total = layout.totalPixels;
      const capacity = processor.max_pixels * cfg.processorQty;
      validation.push(
        capacity >= total
          ? `Processor capacity ${capacity.toLocaleString()} px ≥ ${total.toLocaleString()} px total. Technical verification still required for signal layout.`
          : `Processor capacity ${capacity.toLocaleString()} px is below the ${total.toLocaleString()} px total — add processors or verify.`,
      );
    } else if (processor) {
      validation.push("Processor capacity data incomplete — technical verification required.");
    }
    if (!receiver && !product.integrated_processing)
      validation.push("No receiver card selected — technical verification required.");
    if (product.integrated_processing)
      validation.push(
        "This product uses integrated/proprietary processing — no external processor is charged.",
      );
  }

  // ----- persistence -------------------------------------------------------
  async function save() {
    if (!quote || !totals) {
      toast.error(pricingError ?? "Nothing to save yet.");
      return;
    }
    // An issued/accepted/declined quote is locked: changes must become a revision
    // so the original document and its PDF stay intact.
    if (data && data.quote.status !== "draft") {
      // Only the outcome status may still be recorded (accepted / declined).
      const { error: statusErr } = await supabase
        .from("quotes")
        .update({ status: quote.status })
        .eq("id", quote.id);
      if (statusErr) {
        toast.error(statusErr.message);
        return;
      }
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.message("Quote status updated.", {
        description: "This quote is issued — use “Create revision” to change its contents.",
      });
      return;
    }
    setSaving(true);
    const snapshot = {
      savedAt: new Date().toISOString(),
      exchangeRate: rate,
      exchangeRateDate: quote.exchange_rate_date,
      productLabel: product ? `${product.manufacturers?.name ?? ""} ${product.model}` : null,
      layoutLabel: layout ? `${layout.columns}×${layout.rows} · ${layout.cabinets} cab` : null,
      product,
      receiver,
      processor,
      processorQty: cfg.processorQty,
      layout,
      lines: totals.lines,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      totalCost: totals.totalCost,
      grossProfit: totals.grossProfit,
      ledPerSqm: totals.ledPerSqm,
      ledPerSqft: totals.ledPerSqft,
      systemPerSqm: totals.systemPerSqm,
      systemPerSqft: totals.systemPerSqft,
    };
    const { error: err } = await supabase
      .from("quotes")
      .update({
        status: quote.status,
        is_demo: quote.is_demo,
        customer_company: quote.customer_company,
        contact_name: quote.contact_name,
        contact_email: quote.contact_email,
        contact_phone: quote.contact_phone,
        project_name: quote.project_name,
        currency: quote.currency,
        exchange_rate: quote.exchange_rate,
        exchange_rate_date: quote.exchange_rate_date,
        tax_rate: quote.tax_rate,
        markup_pct: quote.markup_pct,
        margin_pct: quote.margin_pct,
        pricing_mode: quote.pricing_mode,
        issue_date: quote.issue_date,
        valid_until: quote.valid_until,
        payment_terms: quote.payment_terms,
        lead_time: quote.lead_time,
        warranty: quote.warranty,
        exclusions: quote.exclusions,
        notes: quote.notes,
        config: { ...cfg, columns: cols, rows },
        snapshot,
      })
      .eq("id", quote.id);
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    setDirty(false);
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
    toast.success(`${quote.quote_number} saved.`);
  }

  async function addItem(category: string) {
    const { data: row, error: err } = await supabase
      .from("quote_items")
      .insert({
        quote_id: quote!.id,
        category,
        description: CATEGORY_LABELS[category] ?? category,
        quantity: 1,
        unit_cost: 0,
        cost_currency: "USD",
        taxable: true,
        freight_mode: category === "freight" ? "Sea" : null,
        sort_order: items.length,
      })
      .select("*")
      .single();
    if (err) {
      toast.error(err.message);
      return;
    }
    setItems((prev) => [...prev, row as unknown as QuoteItemRow]);
  }

  async function patchItem(id: string, patch: Partial<QuoteItemRow>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error: err } = await supabase.from("quote_items").update(patch).eq("id", id);
    if (err) toast.error(err.message);
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("quote_items").delete().eq("id", id);
  }

  async function createRevision() {
    if (!quote || !me) return;
    const base = quote.quote_number.replace(/-R\d+$/, "");
    const revision = quote.revision + 1;
    const { data: row, error: err } = await supabase
      .from("quotes")
      .insert({
        quote_number: `${base}-R${revision}`,
        revision,
        owner_id: me.userId,
        status: "draft",
        is_demo: quote.is_demo,
        customer_company: quote.customer_company,
        contact_name: quote.contact_name,
        contact_email: quote.contact_email,
        contact_phone: quote.contact_phone,
        project_name: quote.project_name,
        currency: quote.currency,
        exchange_rate: quote.exchange_rate,
        exchange_rate_date: quote.exchange_rate_date,
        tax_rate: quote.tax_rate,
        markup_pct: quote.markup_pct,
        margin_pct: quote.margin_pct,
        pricing_mode: quote.pricing_mode,
        config: quote.config as never,
        snapshot: quote.snapshot as never,
        payment_terms: quote.payment_terms,
        lead_time: quote.lead_time,
        warranty: quote.warranty,
        exclusions: quote.exclusions,
        notes: quote.notes,
        parent_quote_id: quote.id,
      })
      .select("*")
      .single();
    if (err) {
      toast.error(err.message);
      return;
    }
    if (items.length) {
      await supabase.from("quote_items").insert(
        items.map((i) => ({
          quote_id: (row as unknown as Quote).id,
          category: i.category,
          description: i.description,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          cost_currency: i.cost_currency,
          taxable: i.taxable,
          markup_override: i.markup_override,
          margin_override: i.margin_override,
          included_in_led: i.included_in_led,
          freight_mode: i.freight_mode,
          sort_order: i.sort_order,
        })),
      );
    }
    toast.success("Revision created as a new draft. The issued version and its PDF are preserved.");
    navigate({ to: "/quotes/$quoteId", params: { quoteId: (row as unknown as Quote).id } });
  }

  async function exportPdf() {
    if (!quote || !totals) {
      toast.error(pricingError ?? "Configure the display first.");
      return;
    }
    if (dirty) {
      toast.error("Save your changes before exporting the PDF.");
      return;
    }
    const blob = buildQuotePdf({
      quote,
      settings: cat?.settings ?? null,
      salesperson: me?.profile?.full_name || me?.profile?.email || "—",
      product,
      processor: product?.integrated_processing ? null : processor,
      receiver,
      processorQty: cfg.processorQty,
      layout,
      cabinetDepthMm: product?.cabinet_depth_mm != null ? Number(product.cabinet_depth_mm) : null,
      mountingDepthMm: cfg.mountingDepthMm,
      totals,
    });
    const path = `${quote.owner_id}/${quote.id}-r${quote.revision}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("quote-pdfs")
      .upload(path, blob, { upsert: true, contentType: "application/pdf" });
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    await supabase.from("quotes").update({ pdf_path: path }).eq("id", quote.id);
    const { data: signed, error: signErr } = await supabase.storage
      .from("quote-pdfs")
      .createSignedUrl(path, 300);
    if (signErr || !signed) {
      toast.error(signErr?.message ?? "Could not create download link.");
      return;
    }
    window.open(signed.signedUrl, "_blank", "noopener");
    toast.success("Client PDF saved to private storage and opened.");
  }

  const locked = quote.status !== "draft";

  return (
    <div className="space-y-4 pb-16">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="num font-display text-2xl font-semibold">
              {quote.quote_number} · R{quote.revision}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLES[quote.status]}`}
            >
              {quote.status}
            </span>
            {quote.is_demo && (
              <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] text-amber">
                DEMONSTRATION
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {quote.customer_company || "No customer"} · {quote.project_name || "Untitled project"}
            {dirty && <span className="ml-2 text-amber">Unsaved changes</span>}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {locked && (
            <button
              onClick={createRevision}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-white/5"
            >
              Create revision
            </button>
          )}
          <button
            onClick={exportPdf}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-white/5"
          >
            Export client PDF
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-gradient-to-br from-brand to-accent px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save quote"}
          </button>
        </div>
      </div>

      {locked && (
        <p className="glass p-3 text-xs text-amber">
          This quote is {quote.status}. Saving further edits changes the issued record — use “Create
          revision” to keep the issued version and its PDF intact.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        {/* ------------------------------ controls ------------------------- */}
        <section className="glass space-y-4 p-4">
          <h2 className="font-display text-sm font-semibold">Configuration</h2>

          <Field label="LED product variant">
            <select
              value={cfg.ledProductId ?? ""}
              onChange={(e) =>
                updateConfig({
                  ledProductId: e.target.value || null,
                  receiverCardId: null,
                  processorId: null,
                })
              }
              className={inputClass}
            >
              <option value="" className="bg-popover">
                Select a product…
              </option>
              {productGroups.flatMap((manufacturer) =>
                manufacturer.productLines.map((productLine) => (
                  <optgroup
                    key={`${manufacturer.name}-${productLine.name}`}
                    label={`${manufacturer.name} — ${productLine.name}`}
                  >
                    {productLine.products.map((p) => (
                      <option key={p.id} value={p.id} className="bg-popover">
                        {p.model} · P{p.pixel_pitch_mm} · {p.cabinet_width_mm}×{p.cabinet_height_mm}
                        {p.is_demo ? " (DEMO)" : ""}
                      </option>
                    ))}
                  </optgroup>
                )),
              )}
            </select>
          </Field>

          <Field label="Units">
            <select
              value={cfg.unit}
              onChange={(e) => updateConfig({ unit: e.target.value as LengthUnit })}
              className={inputClass}
            >
              <option value="m" className="bg-popover">
                Metres
              </option>
              <option value="mm" className="bg-popover">
                Millimetres
              </option>
              <option value="ft" className="bg-popover">
                Feet
              </option>
            </select>
          </Field>

          <Field label="Sizing mode">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-input bg-secondary/40 p-1 text-xs">
              {(["wall", "desired"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => updateConfig({ mode: m, columns: 0, rows: 0 })}
                  className={`rounded py-1.5 ${cfg.mode === m ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {m === "wall" ? "Wall size" : "Desired size"}
                </button>
              ))}
            </div>
          </Field>

          {cfg.mode === "wall" ? (
            <>
              <TwoNumbers
                label={`Available wall (${cfg.unit})`}
                a={cfg.wallWidth}
                b={cfg.wallHeight}
                onA={(v) => updateConfig({ wallWidth: v, columns: 0, rows: 0 })}
                onB={(v) => updateConfig({ wallHeight: v, columns: 0, rows: 0 })}
              />
              <TwoNumbers
                label={`Clearance each side (${cfg.unit})`}
                a={cfg.clearanceX}
                b={cfg.clearanceY}
                onA={(v) => updateConfig({ clearanceX: v, columns: 0, rows: 0 })}
                onB={(v) => updateConfig({ clearanceY: v, columns: 0, rows: 0 })}
              />
            </>
          ) : (
            <TwoNumbers
              label={`Target display size (${cfg.unit})`}
              a={cfg.targetWidth}
              b={cfg.targetHeight}
              onA={(v) => updateConfig({ targetWidth: v, columns: 0, rows: 0 })}
              onB={(v) => updateConfig({ targetHeight: v, columns: 0, rows: 0 })}
            />
          )}

          <TwoNumbers
            label="Cabinet grid (columns × rows)"
            a={cols}
            b={rows}
            onA={(v) => updateConfig({ columns: Math.max(0, Math.round(v)) })}
            onB={(v) => updateConfig({ rows: Math.max(0, Math.round(v)) })}
          />

          <Field label="Mounting depth (mm, blank = not specified)">
            <input
              type="number"
              value={cfg.mountingDepthMm ?? ""}
              onChange={(e) =>
                updateConfig({
                  mountingDepthMm: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Receiver card (compatibility filtered)">
            <select
              value={cfg.receiverCardId ?? ""}
              onChange={(e) =>
                updateConfig({ receiverCardId: e.target.value || null, processorId: null })
              }
              className={inputClass}
            >
              <option value="" className="bg-popover">
                {product ? "Select a receiver card…" : "Select a product first"}
              </option>
              {compatibleReceivers.map((r) => (
                <option key={r.id} value={r.id} className="bg-popover">
                  {r.manufacturer_name} {r.model}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Processor (compatibility filtered)">
            <select
              value={cfg.processorId ?? ""}
              disabled={product?.integrated_processing}
              onChange={(e) => updateConfig({ processorId: e.target.value || null })}
              className={inputClass}
            >
              <option value="" className="bg-popover">
                {product?.integrated_processing
                  ? "Integrated processing — none required"
                  : receiver
                    ? "Select a processor…"
                    : "Select a receiver card first"}
              </option>
              {compatibleProcessors.map((p) => (
                <option key={p.id} value={p.id} className="bg-popover">
                  {p.manufacturer_name} {p.model}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Processor quantity">
            <input
              type="number"
              min={0}
              value={cfg.processorQty}
              onChange={(e) => updateConfig({ processorQty: Math.max(0, Number(e.target.value)) })}
              className={inputClass}
            />
          </Field>
        </section>

        {/* ------------------------------ drawing -------------------------- */}
        <section className="space-y-4">
          <div className="glass p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-semibold">Front elevation & side profile</h2>
              {product?.is_demo && (
                <span className="rounded-md bg-amber/15 px-2 py-1 text-[10px] text-amber">
                  FICTIONAL DEMO PRODUCT
                </span>
              )}
            </div>

            {!product && (
              <p className="mt-4 text-sm text-muted-foreground">
                Select an LED product variant to generate the drawing.
              </p>
            )}
            {product && cfg.mode === "wall" && wallFit?.message && (
              <p className="mt-4 text-sm text-destructive">{wallFit.message}</p>
            )}
            {exceedsWall && (
              <p className="mt-3 text-sm text-destructive">
                Manual grid exceeds the usable wall space. Reduce rows or columns.
              </p>
            )}
            {product && layout && (
              <div className="mt-4">
                <DisplayDrawing
                  layout={layout}
                  cabinetWidthMm={Number(product.cabinet_width_mm)}
                  cabinetHeightMm={Number(product.cabinet_height_mm)}
                  cabinetDepthMm={
                    product.cabinet_depth_mm != null ? Number(product.cabinet_depth_mm) : null
                  }
                  mountingDepthMm={cfg.mountingDepthMm}
                  wallWidthMm={(cfg.mode === "wall" ? wallFit?.usableWidthMm : null) ?? null}
                  wallHeightMm={(cfg.mode === "wall" ? wallFit?.usableHeightMm : null) ?? null}
                />
              </div>
            )}
          </div>

          {cfg.mode === "desired" && options.length > 0 && (
            <div className="glass p-4">
              <h2 className="font-display text-sm font-semibold">Nearby whole-cabinet layouts</h2>
              <div className="mt-3 space-y-1 text-xs">
                {options.map((o, idx) => (
                  <button
                    key={`${o.layout.columns}x${o.layout.rows}`}
                    onClick={() => updateConfig({ columns: o.layout.columns, rows: o.layout.rows })}
                    className="num flex w-full items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-left hover:border-brand/40"
                  >
                    <span className="w-20">
                      {o.layout.columns} × {o.layout.rows}
                    </span>
                    <span className="w-40 text-muted-foreground">
                      {formatNumber(o.layout.widthMm / 1000, 3)} ×{" "}
                      {formatNumber(o.layout.heightMm / 1000, 3)} m
                    </span>
                    <span className="text-muted-foreground">
                      Δ {o.widthDeltaMm >= 0 ? "+" : ""}
                      {Math.round(o.widthDeltaMm)} mm W · {o.heightDeltaMm >= 0 ? "+" : ""}
                      {Math.round(o.heightDeltaMm)} mm H
                    </span>
                    {idx === 0 && <span className="ml-auto text-brand">Recommended</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* charges */}
          <div className="glass p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-semibold">Charges</h2>
              <div className="ml-auto flex flex-wrap gap-1">
                {MANUAL_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => addItem(c)}
                    className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/5"
                  >
                    + {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              {derived.map((d) => (
                <div
                  key={d.category}
                  className="num grid grid-cols-[1fr_80px_90px_60px_90px] items-center gap-2 rounded-lg border border-border bg-white/[0.02] px-3 py-2"
                >
                  <span>{d.description}</span>
                  <span className="text-muted-foreground">{formatNumber(d.quantity)}</span>
                  <span className="text-muted-foreground">
                    {formatMoney(d.unit_cost, d.cost_currency)}
                  </span>
                  <span className="text-muted-foreground">{d.cost_currency}</span>
                  <span className="text-right">
                    {d.included_in_led ? (
                      <span className="text-mint">Included</span>
                    ) : (
                      formatMoney(
                        totals?.lines.find((l) => l.category === d.category)?.sellingPrice ?? 0,
                        quote.currency,
                      )
                    )}
                  </span>
                </div>
              ))}

              {items.map((i) => (
                <div
                  key={i.id}
                  className="grid grid-cols-[1fr_70px_90px_70px_70px_70px_28px] items-center gap-2 rounded-lg border border-border bg-white/[0.02] px-3 py-2"
                >
                  <input
                    value={i.description}
                    onChange={(e) => patchItem(i.id, { description: e.target.value })}
                    className="rounded bg-transparent px-1 py-1 outline-none focus:bg-secondary/40"
                  />
                  <input
                    type="number"
                    value={i.quantity}
                    onChange={(e) => patchItem(i.id, { quantity: Number(e.target.value) })}
                    className="num rounded bg-transparent px-1 py-1 outline-none focus:bg-secondary/40"
                  />
                  <input
                    type="number"
                    value={i.unit_cost}
                    onChange={(e) => patchItem(i.id, { unit_cost: Number(e.target.value) })}
                    className="num rounded bg-transparent px-1 py-1 outline-none focus:bg-secondary/40"
                  />
                  <select
                    value={i.cost_currency}
                    onChange={(e) => patchItem(i.id, { cost_currency: e.target.value as Currency })}
                    className="rounded bg-transparent py-1 outline-none"
                  >
                    <option className="bg-popover">USD</option>
                    <option className="bg-popover">CAD</option>
                  </select>
                  {i.category === "freight" ? (
                    <select
                      value={i.freight_mode ?? "Sea"}
                      onChange={(e) => patchItem(i.id, { freight_mode: e.target.value })}
                      className="rounded bg-transparent py-1 outline-none"
                    >
                      <option className="bg-popover">Air</option>
                      <option className="bg-popover">Sea</option>
                    </select>
                  ) : (
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={i.taxable}
                        onChange={(e) => patchItem(i.id, { taxable: e.target.checked })}
                      />
                      Tax
                    </label>
                  )}
                  <span className="num text-right">
                    {formatMoney(
                      totals?.lines.find((l) => l.id === i.id)?.sellingPrice ?? 0,
                      quote.currency,
                    )}
                  </span>
                  <button
                    onClick={() => removeItem(i.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* quote details */}
          <div className="glass grid gap-3 p-4 md:grid-cols-2">
            <h2 className="font-display text-sm font-semibold md:col-span-2">Quote details</h2>
            <Field label="Customer / company">
              <input
                value={quote.customer_company ?? ""}
                onChange={(e) => update({ customer_company: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Project name">
              <input
                value={quote.project_name ?? ""}
                onChange={(e) => update({ project_name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Contact name">
              <input
                value={quote.contact_name ?? ""}
                onChange={(e) => update({ contact_name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Contact email">
              <input
                value={quote.contact_email ?? ""}
                onChange={(e) => update({ contact_email: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Contact phone">
              <input
                value={quote.contact_phone ?? ""}
                onChange={(e) => update({ contact_phone: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Status">
              <select
                value={quote.status}
                onChange={(e) => update({ status: e.target.value as Quote["status"] })}
                className={inputClass}
              >
                {["draft", "issued", "accepted", "declined"].map((s) => (
                  <option key={s} value={s} className="bg-popover capitalize">
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issue date">
              <input
                type="date"
                value={quote.issue_date ?? ""}
                onChange={(e) => update({ issue_date: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Valid until">
              <input
                type="date"
                value={quote.valid_until ?? ""}
                onChange={(e) => update({ valid_until: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Payment terms">
              <input
                value={quote.payment_terms ?? ""}
                onChange={(e) => update({ payment_terms: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Lead time">
              <input
                value={quote.lead_time ?? ""}
                onChange={(e) => update({ lead_time: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Warranty">
              <input
                value={quote.warranty ?? ""}
                onChange={(e) => update({ warranty: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Exclusions">
              <input
                value={quote.exclusions ?? ""}
                onChange={(e) => update({ exclusions: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Internal notes (never printed on the client PDF)">
              <textarea
                value={quote.notes ?? ""}
                onChange={(e) => update({ notes: e.target.value })}
                className={`${inputClass} h-20`}
              />
            </Field>
            <Field label="Demonstration quote">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={quote.is_demo}
                  onChange={(e) => update({ is_demo: e.target.checked })}
                />
                Mark this quote as a visible demonstration
              </label>
            </Field>
          </div>
        </section>

        {/* ------------------------------ summary -------------------------- */}
        <section className="space-y-4">
          <div className="glass p-4">
            <h2 className="font-display text-sm font-semibold">Specification summary</h2>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
              <Cell
                label="Cabinets"
                value={layout ? `${layout.columns} × ${layout.rows} = ${layout.cabinets}` : "—"}
              />
              <Cell
                label="Resolution"
                value={layout ? `${layout.pixelWidth} × ${layout.pixelHeight}` : "—"}
              />
              <Cell
                label="Size"
                value={
                  layout
                    ? `${formatNumber(layout.widthMm / 1000, 3)} × ${formatNumber(layout.heightMm / 1000, 3)} m`
                    : "—"
                }
              />
              <Cell
                label="Diagonal"
                value={layout ? `${formatNumber(layout.diagonalMm / 1000, 2)} m` : "—"}
              />
              <Cell label="Area" value={layout ? `${formatNumber(layout.areaSqm)} m²` : "—"} />
              <Cell label="Area" value={layout ? `${formatNumber(layout.areaSqft)} ft²` : "—"} />
              <Cell label="Aspect" value={layout?.aspectRatio ?? "—"} />
              <Cell
                label="Pixel density"
                value={layout ? `${formatNumber(layout.pixelsPerSqm, 0)} /m²` : "—"}
              />
              <Cell
                label="Weight"
                value={
                  layout?.weightKg != null ? `${formatNumber(layout.weightKg)} kg` : "Not specified"
                }
              />
              <Cell
                label="Power typ/max"
                value={
                  layout?.powerTypicalW != null
                    ? `${formatNumber(layout.powerTypicalW, 0)} / ${formatNumber(layout.powerMaxW, 0)} W`
                    : "Not specified"
                }
              />
            </div>
            {validation.length > 0 && (
              <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                {validation.map((v) => (
                  <li key={v}>· {v}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass space-y-3 p-4">
            <h2 className="font-display text-sm font-semibold">Currency & pricing</h2>
            <Field label="Quote output currency">
              <select
                value={quote.currency}
                onChange={(e) => update({ currency: e.target.value as Currency })}
                className={inputClass}
              >
                <option className="bg-popover">CAD</option>
                <option className="bg-popover">USD</option>
              </select>
            </Field>
            <Field label="Exchange rate — 1 USD = X CAD">
              <input
                type="number"
                step="0.0001"
                value={quote.exchange_rate ?? ""}
                onChange={(e) =>
                  update({ exchange_rate: e.target.value === "" ? null : Number(e.target.value) })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Rate date">
              <input
                type="date"
                value={quote.exchange_rate_date ?? ""}
                onChange={(e) => update({ exchange_rate_date: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Tax rate (%) applied to taxable selling lines">
              <input
                type="number"
                step="0.01"
                value={quote.tax_rate}
                onChange={(e) => update({ tax_rate: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Markup %">
                <input
                  type="number"
                  step="0.01"
                  value={quote.markup_pct}
                  onChange={(e) => {
                    const markup = Number(e.target.value);
                    update({
                      markup_pct: markup,
                      margin_pct: markupToMargin(markup),
                      pricing_mode: "markup",
                    });
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="Margin %">
                <input
                  type="number"
                  step="0.01"
                  value={quote.margin_pct}
                  onChange={(e) => {
                    const margin = Number(e.target.value);
                    if (margin >= 100) {
                      toast.error("Margin must be below 100%.");
                      return;
                    }
                    update({
                      margin_pct: margin,
                      markup_pct: marginToMarkup(margin),
                      pricing_mode: "margin",
                    });
                  }}
                  className={inputClass}
                />
              </Field>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Driving input: {quote.pricing_mode}. Selling price ={" "}
              {quote.pricing_mode === "markup"
                ? "cost × (1 + markup/100)"
                : "cost ÷ (1 − margin/100)"}
              .
            </p>
          </div>

          {pricingError && <p className="glass p-3 text-xs text-destructive">{pricingError}</p>}

          {totals && (
            <div className="glass space-y-2 p-4 text-sm">
              <h2 className="font-display text-sm font-semibold">Internal figures</h2>
              <Line label="Internal cost" value={formatMoney(totals.totalCost, quote.currency)} />
              <Line label="Selling subtotal" value={formatMoney(totals.subtotal, quote.currency)} />
              <Line label="Gross profit" value={formatMoney(totals.grossProfit, quote.currency)} />
              <Line label="Effective markup" value={`${formatNumber(totals.markupPct)}%`} />
              <Line label="Effective margin" value={`${formatNumber(totals.marginPct)}%`} />
              <div className="my-2 h-px bg-border" />
              <Line label="Tax" value={formatMoney(totals.tax, quote.currency)} />
              <Line
                label={`Total (${quote.currency})`}
                value={formatMoney(totals.total, quote.currency)}
                strong
              />
              <div className="my-2 h-px bg-border" />
              <Line
                label="LED-only selling / m²"
                value={formatMoney(totals.ledPerSqm, quote.currency)}
              />
              <Line
                label="LED-only selling / ft²"
                value={formatMoney(totals.ledPerSqft, quote.currency)}
              />
              <Line
                label="Complete system / m² (excl. tax)"
                value={formatMoney(totals.systemPerSqm, quote.currency)}
              />
              <Line
                label="Complete system / ft² (excl. tax)"
                value={formatMoney(totals.systemPerSqft, quote.currency)}
              />
              {rate && quote.currency === "CAD" && (
                <p className="pt-1 text-[11px] text-muted-foreground">
                  USD costs converted at 1 USD = {rate} CAD ({quote.exchange_rate_date}). Example:
                  $100 USD = {formatMoney(convert(100, "USD", "CAD", rate), "CAD")}.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function TwoNumbers({
  label,
  a,
  b,
  onA,
  onB,
}: {
  label: string;
  a: number;
  b: number;
  onA: (v: number) => void;
  onB: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="any"
          value={a}
          onChange={(e) => onA(Number(e.target.value))}
          className={`num ${inputClass}`}
        />
        <input
          type="number"
          step="any"
          value={b}
          onChange={(e) => onB(Number(e.target.value))}
          className={`num ${inputClass}`}
        />
      </div>
    </Field>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-2.5">
      <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="num text-sm font-medium">{value}</div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
