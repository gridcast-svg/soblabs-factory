import { useState } from "react";
import type { Layout } from "@/lib/led-calc";

/** Conceptual layers only: not manufacturer CAD or a wiring diagram. */
export function ExplodedDisplay({ layout }: { layout: Layout }) {
  const [explode, setExplode] = useState(55);
  const [rotation, setRotation] = useState(-25);
  const ratio = Math.max(0.25, Math.min(4, layout.widthMm / Math.max(layout.heightMm, 1)));
  const width = Math.min(260, 200 * ratio);
  const height = width / ratio;
  const layers = [
    { name: "Mounting structure", color: "#52616b", z: -1 },
    { name: "Cabinet enclosure", color: "#243740", z: 0 },
    { name: "LED face", color: "#147e82", z: 1 },
  ];
  return (
    <section className="glass space-y-3 p-4" aria-label="Exploded display schematic">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Exploded view</h3>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            setExplode(55);
            setRotation(-25);
          }}
        >
          Reset view
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Concept schematic — layers and separation are illustrative. Not manufacturer CAD,
        installation guidance or a wiring diagram.
      </p>
      <div
        className="relative flex h-80 items-center justify-center overflow-hidden rounded-lg bg-slate-950"
        style={{ perspective: 900 }}
      >
        <div
          style={{
            width,
            height,
            position: "relative",
            transformStyle: "preserve-3d",
            transform: `rotateX(12deg) rotateY(${rotation}deg)`,
          }}
        >
          {layers.map((layer) => (
            <div
              key={layer.name}
              style={{
                position: "absolute",
                inset: 0,
                transform: `translateZ(${layer.z * explode}px)`,
                border: "2px solid #92c9ca",
                backgroundColor: layer.color,
                opacity: 0.93,
                boxShadow: "0 8px 24px #0006",
                backgroundImage:
                  "linear-gradient(to right, #ffffff40 1px, transparent 1px),linear-gradient(to bottom, #ffffff40 1px, transparent 1px)",
                backgroundSize: `${100 / Math.max(layout.columns, 1)}% ${100 / Math.max(layout.rows, 1)}%`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Layer separation: {explode}%
          <input
            className="mt-2 w-full"
            aria-label="Layer separation"
            type="range"
            min="0"
            max="100"
            value={explode}
            onChange={(e) => setExplode(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Rotation: {rotation}°
          <input
            className="mt-2 w-full"
            aria-label="Display rotation"
            type="range"
            min="-70"
            max="70"
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        {layers.map((layer) => (
          <span key={layer.name} className="flex items-center gap-2">
            <span
              style={{ background: layer.color }}
              className="inline-block h-3 w-3 rounded border"
            />
            {layer.name}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {layout.columns} columns × {layout.rows} rows · {layout.widthMm} × {layout.heightMm} mm.
        Accurate dimensions remain in the 2D drawing.
      </p>
    </section>
  );
}
