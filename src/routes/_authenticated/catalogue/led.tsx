import { UslimImport } from "@/components/UslimImport";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { RecordEditor, type FieldSpec } from "@/components/RecordEditor";
import { orNotSpecified } from "@/lib/led-calc";
import type { Hardware, LedProduct } from "@/lib/types";
import { duplicateRecord, splitRecord } from "@/lib/record-utils";
import { groupLedProducts } from "@/lib/catalogue-groups";

export const Route = createFileRoute("/_authenticated/catalogue/led")({
  head: () => ({
    meta: [
      { title: "LED Catalogue — Soblabs LED Configurator" },
      {
        name: "description",
        content: "Editable LED cabinet catalogue: pitch, cabinet pixels, power, weight and cost.",
      },
      { property: "og:title", content: "LED Catalogue — Soblabs" },
      {
        property: "og:description",
        content: "Every cabinet size and pixel-pitch combination as its own variant.",
      },
    ],
  }),
  component: LedCatalogue,
});

const FIELDS: FieldSpec[] = [
  { key: "series", label: "Product line" },
  { key: "model", label: "Model" },
  { key: "sku", label: "SKU" },
  { key: "description", label: "Description", type: "textarea" },
  {
    key: "application",
    label: "Application",
    type: "select",
    options: [
      { value: "indoor", label: "Indoor" },
      { value: "outdoor", label: "Outdoor" },
    ],
  },
  { key: "pixel_pitch_mm", label: "Pixel pitch (mm)", type: "number" },
  { key: "cabinet_width_mm", label: "Cabinet width (mm)", type: "number" },
  { key: "cabinet_height_mm", label: "Cabinet height (mm)", type: "number" },
  { key: "cabinet_depth_mm", label: "Cabinet depth (mm)", type: "number" },
  { key: "cabinet_pixel_width", label: "Cabinet pixels wide", type: "number" },
  { key: "cabinet_pixel_height", label: "Cabinet pixels high", type: "number" },
  { key: "diode_technology", label: "Diode technology" },
  { key: "diode_manufacturer", label: "Diode manufacturer" },
  { key: "diode_package", label: "Diode package / model" },
  { key: "diode_notes", label: "Diode notes" },
  { key: "power_supply_brand", label: "Power supply brand / model" },
  { key: "power_supply_qty", label: "Power supplies per cabinet", type: "number" },
  { key: "power_supply_redundancy", label: "Redundancy notes" },
  { key: "power_typical_sqm", label: "Typical power (W/m²)", type: "number" },
  { key: "power_max_sqm", label: "Maximum power (W/m²)", type: "number" },
  { key: "cabinet_weight_kg", label: "Cabinet weight (kg)", type: "number" },
  { key: "brightness_nits", label: "Brightness (nits)", type: "number" },
  { key: "refresh_rate_hz", label: "Refresh rate (Hz)", type: "number" },
  { key: "service_access", label: "Service access" },
  { key: "ip_rating", label: "IP rating" },
  { key: "supplier_cost_per_sqm", label: "Supplier cost per m²", type: "number" },
  {
    key: "supplier_currency",
    label: "Supplier currency",
    type: "select",
    options: [
      { value: "USD", label: "USD" },
      { value: "CAD", label: "CAD" },
    ],
  },
  { key: "receiver_cards_per_cabinet", label: "Receiver cards per cabinet", type: "number" },
  {
    key: "receiver_card_included",
    label: "Receiver card cost included in LED price",
    type: "checkbox",
  },
  { key: "integrated_processing", label: "Integrated / proprietary processing", type: "checkbox" },
  { key: "processing_requirements", label: "Processing requirements" },
  { key: "datasheet_url", label: "Datasheet link" },
  { key: "spec_source", label: "Specification source" },
  { key: "last_verified_at", label: "Last verified", type: "date" },
  { key: "is_demo", label: "Fictional demonstration product", type: "checkbox" },
];

function LedCatalogue() {
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const { data } = useQuery({
    queryKey: ["led-catalogue"],
    queryFn: async () => {
      const [products, manufacturers, receivers, compat] = await Promise.all([
        supabase.from("led_products").select("*, manufacturers(name)").order("model"),
        supabase.from("manufacturers").select("*").order("name"),
        supabase.from("receiver_cards").select("*").order("model"),
        supabase.from("led_receiver_compat").select("*"),
      ]);
      return {
        products: (products.data ?? []) as unknown as LedProduct[],
        manufacturers: (manufacturers.data ?? []) as { id: string; name: string }[],
        receivers: (receivers.data ?? []) as unknown as Hardware[],
        compat: (compat.data ?? []) as {
          id: string;
          led_product_id: string;
          receiver_card_id: string;
        }[],
      };
    },
  });

  const isAdmin = !!me?.isAdmin;
  const manufacturerGroups = useMemo(
    () => groupLedProducts(data?.products ?? []),
    [data?.products],
  );

  async function saveRecord() {
    if (!editing) return;
    const area = (Number(editing["cabinet_width_mm"]) * Number(editing["cabinet_height_mm"])) / 1e6;
    if (
      !(area > 0) ||
      ![editing["cabinet_pixel_width"], editing["cabinet_pixel_height"]].every(
        (v) => Number.isInteger(Number(v)) && Number(v) > 0,
      )
    ) {
      toast.error(
        "Enter valid cabinet dimensions and confirmed positive integer cabinet pixel counts before saving.",
      );
      return;
    }
    const powers = [editing["power_typical_sqm"], editing["power_max_sqm"]];
    if (powers.some((v) => v != null && (!Number.isFinite(Number(v)) || Number(v) < 0))) {
      toast.error("Power must be a non-negative number.");
      return;
    }
    if (powers[0] != null && powers[1] != null && Number(powers[0]) > Number(powers[1])) {
      toast.error("Typical power cannot exceed maximum power.");
      return;
    }
    const { id, payload } = splitRecord(editing, [
      "manufacturers",
      "power_typical_sqm",
      "power_max_sqm",
    ]);
    payload["power_typical_w"] = powers[0] == null ? null : Number(powers[0]) * area;
    payload["power_max_w"] = powers[1] == null ? null : Number(powers[1]) * area;
    const { error } = id
      ? await supabase
          .from("led_products")
          .update(payload as never)
          .eq("id", id)
      : await supabase.from("led_products").insert(payload as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Catalogue saved. Existing quotes keep their saved snapshot.");
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["led-catalogue"] });
    queryClient.invalidateQueries({ queryKey: ["catalogue"] });
  }

  async function toggleCompat(productId: string, receiverId: string, on: boolean) {
    if (on) {
      await supabase
        .from("led_receiver_compat")
        .insert({ led_product_id: productId, receiver_card_id: receiverId, verified: true });
    } else {
      await supabase
        .from("led_receiver_compat")
        .delete()
        .eq("led_product_id", productId)
        .eq("receiver_card_id", receiverId);
    }
    queryClient.invalidateQueries({ queryKey: ["led-catalogue"] });
    queryClient.invalidateQueries({ queryKey: ["catalogue"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">LED Catalogue</h1>
        {isAdmin && (
          <button
            onClick={() =>
              setEditing({
                manufacturer_id: data?.manufacturers[0]?.id ?? "",
                model: "",
                application: "indoor",
                supplier_currency: "USD",
                receiver_cards_per_cabinet: 1,
                status: "active",
              })
            }
            className="ml-auto rounded-lg bg-gradient-to-br from-brand to-accent px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            + New variant
          </button>
        )}
      </div>

      {isAdmin && (
        <UslimImport
          onReview={(record) => {
            const manufacturer = data?.manufacturers.find(
              (m) => m.name.toLowerCase() === "unilumin",
            );
            if (!manufacturer) {
              toast.error("Unilumin manufacturer is not available in the connected catalogue.");
              return;
            }
            setEditing({ ...record, manufacturer_id: manufacturer.id });
          }}
        />
      )}
      {editing && isAdmin && (
        <div className="glass space-y-3 p-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-sm font-semibold">
              {editing["id"] ? "Edit variant" : "New variant"}
            </h2>
            <select
              value={(editing["manufacturer_id"] as string) ?? ""}
              onChange={(e) => setEditing({ ...editing, manufacturer_id: e.target.value })}
              className="rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm"
            >
              {data?.manufacturers.map((m) => (
                <option key={m.id} value={m.id} className="bg-popover">
                  {m.name}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveRecord}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Save
              </button>
            </div>
          </div>
          <RecordEditor
            fields={FIELDS}
            value={editing}
            onChange={(patch) => setEditing({ ...editing, ...patch })}
          />
          <p className="text-[11px] text-muted-foreground">
            Leave unknown specifications blank — they display as “Not specified”. Calculations use
            the exact cabinet pixel counts, not the advertised pitch.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {manufacturerGroups.map((manufacturer) => (
          <section key={manufacturer.name}>
            <div className="mb-3 flex items-baseline gap-2 border-b border-border/70 pb-2">
              <h2 className="font-display text-xl font-semibold">{manufacturer.name}</h2>
              <span className="text-xs text-muted-foreground">
                {manufacturer.productLines.reduce((total, line) => total + line.products.length, 0)}{" "}
                products
              </span>
            </div>
            <div className="space-y-5">
              {manufacturer.productLines.map((productLine) => (
                <section key={productLine.name}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <h3 className="text-sm font-semibold text-foreground">{productLine.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {productLine.products.length}{" "}
                      {productLine.products.length === 1 ? "variant" : "variants"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {productLine.products.map((p) => {
                      const linked = (data?.compat ?? []).filter((c) => c.led_product_id === p.id);
                      return (
                        <div key={p.id} className="glass p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{p.model}</span>
                            <span className="num text-xs text-muted-foreground">
                              P{p.pixel_pitch_mm} · {p.cabinet_width_mm}×{p.cabinet_height_mm} mm ·{" "}
                              {p.cabinet_pixel_width}×{p.cabinet_pixel_height} px · {p.application}
                            </span>
                            {p.is_demo && (
                              <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] text-amber">
                                FICTIONAL DEMO
                              </span>
                            )}
                            {p.status !== "active" && (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                                Archived
                              </span>
                            )}
                            {isAdmin && (
                              <span className="ml-auto flex gap-3 text-xs">
                                <button
                                  onClick={() =>
                                    setEditing({
                                      ...p,
                                      power_typical_sqm:
                                        p.power_typical_w == null
                                          ? null
                                          : p.power_typical_w /
                                            ((p.cabinet_width_mm * p.cabinet_height_mm) / 1e6),
                                      power_max_sqm:
                                        p.power_max_w == null
                                          ? null
                                          : p.power_max_w /
                                            ((p.cabinet_width_mm * p.cabinet_height_mm) / 1e6),
                                    })
                                  }
                                  className="text-brand hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    setEditing(
                                      duplicateRecord(
                                        {
                                          ...p,
                                          power_typical_sqm:
                                            p.power_typical_w == null
                                              ? null
                                              : p.power_typical_w /
                                                ((p.cabinet_width_mm * p.cabinet_height_mm) / 1e6),
                                          power_max_sqm:
                                            p.power_max_w == null
                                              ? null
                                              : p.power_max_w /
                                                ((p.cabinet_width_mm * p.cabinet_height_mm) / 1e6),
                                        } as Record<string, unknown>,
                                        ["manufacturers"],
                                      ),
                                    )
                                  }
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  Duplicate
                                </button>
                                <button
                                  onClick={async () => {
                                    await supabase
                                      .from("led_products")
                                      .update({
                                        status: p.status === "active" ? "archived" : "active",
                                      })
                                      .eq("id", p.id);
                                    queryClient.invalidateQueries({ queryKey: ["led-catalogue"] });
                                  }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {p.status === "active" ? "Archive" : "Restore"}
                                </button>
                              </span>
                            )}
                          </div>
                          <div className="num mt-2 grid gap-1 text-[11px] text-muted-foreground md:grid-cols-4">
                            <span>Diode: {orNotSpecified(p.diode_technology)}</span>
                            <span>
                              Power:{" "}
                              {orNotSpecified(
                                p.power_typical_w == null
                                  ? null
                                  : Number(
                                      (
                                        p.power_typical_w /
                                        ((p.cabinet_width_mm * p.cabinet_height_mm) / 1e6)
                                      ).toFixed(2),
                                    ),
                                " W/m²",
                              )}{" "}
                              typ /{" "}
                              {orNotSpecified(
                                p.power_max_w == null
                                  ? null
                                  : Number(
                                      (
                                        p.power_max_w /
                                        ((p.cabinet_width_mm * p.cabinet_height_mm) / 1e6)
                                      ).toFixed(2),
                                    ),
                                " W/m²",
                              )}{" "}
                              max
                            </span>
                            <span>Weight: {orNotSpecified(p.cabinet_weight_kg, " kg")}</span>
                            <span>
                              Cost: {orNotSpecified(p.supplier_cost_per_sqm)} {p.supplier_currency}{" "}
                              / m²
                            </span>
                            <span>Brightness: {orNotSpecified(p.brightness_nits, " nits")}</span>
                            <span>Refresh: {orNotSpecified(p.refresh_rate_hz, " Hz")}</span>
                            <span>IP: {orNotSpecified(p.ip_rating)}</span>
                            <span>Verified: {orNotSpecified(p.last_verified_at)}</span>
                          </div>

                          <div className="mt-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              Approved receiver cards
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs">
                              {(data?.receivers ?? []).map((r) => {
                                const on = linked.some((c) => c.receiver_card_id === r.id);
                                return (
                                  <label
                                    key={r.id}
                                    className="flex items-center gap-1.5 text-muted-foreground"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      disabled={!isAdmin}
                                      onChange={(e) => toggleCompat(p.id, r.id, e.target.checked)}
                                    />
                                    {r.manufacturer_name} {r.model}
                                  </label>
                                );
                              })}
                              {(data?.receivers ?? []).length === 0 && (
                                <span className="text-muted-foreground">
                                  No receiver cards in the catalogue yet.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
