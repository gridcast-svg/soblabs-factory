import { useState } from "react";
const pitches = [
  { pitch: 1.5, brightness: 800, refresh: 5760, power: 480 },
  { pitch: 1.9, brightness: 900, refresh: 7680, power: 460 },
  { pitch: 2.5, brightness: 1000, refresh: 7680, power: 450 },
  { pitch: 3.9, brightness: 1000, refresh: 7680, power: 440 },
];
const sizes = [
  [500, 1000],
  [250, 750],
  [250, 500],
] as const;
export function UslimImport({ onReview }: { onReview: (record: Record<string, unknown>) => void }) {
  const [size, setSize] = useState(0);
  return (
    <section className="glass space-y-3 p-4">
      <h2 className="font-semibold">From your specification sheets: Unilumin Uslim III</h2>
      <p className="text-sm text-muted-foreground">
        Import candidates — confirm this cabinet size is available at the selected pitch. Exact
        cabinet pixel counts and supplier pricing are missing. Typical power, diode and hardware
        details are not specified.
      </p>
      <label className="block text-sm">
        Cabinet size to review{" "}
        <select
          className="ml-2 rounded border bg-background p-2"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        >
          {sizes.map(([w, h], i) => (
            <option key={i} value={i}>
              {w} × {h} × 40 mm
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {pitches.map((p) => (
          <div className="rounded-lg border border-border p-3" key={p.pitch}>
            <h3 className="font-medium">Uslim III · P{p.pitch}</h3>
            <p className="text-sm text-muted-foreground">
              {p.brightness} nits · {p.refresh.toLocaleString()} Hz
              <br />
              Maximum {p.power} W/m² · Typical: Not specified
            </p>
            <button
              type="button"
              className="mt-3 text-sm text-brand underline"
              onClick={() =>
                onReview({
                  series: "Uslim III",
                  model: `Uslim III P${p.pitch} ${(sizes[size] ?? sizes[0])[0]}×${(sizes[size] ?? sizes[0])[1]}`,
                  application: "indoor",
                  status: "active",
                  is_demo: false,
                  pixel_pitch_mm: p.pitch,
                  cabinet_width_mm: (sizes[size] ?? sizes[0])[0],
                  cabinet_height_mm: (sizes[size] ?? sizes[0])[1],
                  cabinet_depth_mm: 40,
                  brightness_nits: p.brightness,
                  refresh_rate_hz: p.refresh,
                  power_max_sqm: p.power,
                  power_typical_sqm: null,
                  service_access: "Front and rear",
                  supplier_currency: "USD",
                  spec_source:
                    "UslimⅢ.pdf, page 2; brightness interpreted as nits per owner clarification. Confirm pitch/size availability. Exact pixels, diode, PSU and processing not provided.",
                  description:
                    "Contrast 5000:1. Published weights 10.5/4.5/3.5 kg: cabinet mapping requires confirmation.",
                  processing_requirements:
                    "Technical verification required; compatibility not supplied.",
                })
              }
            >
              Review and complete variant
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
