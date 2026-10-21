import { z } from "zod";

const positive = z.number().finite().positive().max(1_000_000_000);
const optional = positive.nullable();
const whole = positive.int();
const point = z.object({
  x: z.number().int().min(0).max(4999),
  y: z.number().int().min(0).max(4999),
});
const runs = z
  .array(z.array(point).max(5000))
  .max(5000)
  .refine(
    (value) => value.reduce((n, run) => n + run.length, 0) <= 5000,
    "Too many routed cabinets",
  );

export const ledGeometrySchema = z.object({
  width: positive.max(10_000_000),
  height: positive.max(10_000_000),
  cabinetWidth: positive.max(100_000),
  cabinetHeight: positive.max(100_000),
  pixelWidth: whole.max(100_000),
  pixelHeight: whole.max(100_000),
  costPerSqm: z.number().finite().nonnegative().nullable(),
});

export const ledPlannerSchema = z.object({
  mode: z.enum(["wall", "count"]).default("wall"),
  columns: whole.max(5000).default(12),
  rows: whole.max(5000).default(6),
  requestedPitchMm: positive.max(100).nullable().default(null),
  brightnessNits: optional.default(null),
  refreshHz: whole.nullable().default(null),
  cabinetManufacturer: z.string().max(120).default(""),
  cabinetModel: z.string().max(120).default(""),
  specSource: z.string().max(1000).default(""),
  weightKg: optional.default(null),
  maxPowerW: optional.default(null),
  typicalPowerW: optional.default(null),
  processorModel: z.string().max(120).default(""),
  pixelsPerPort: whole.nullable().default(null),
  dataPorts: whole.max(1024).nullable().default(null),
  processorPixels: whole.nullable().default(null),
  canvasWidth: whole.nullable().default(null),
  canvasHeight: whole.nullable().default(null),
  voltage: positive.max(1000).default(120),
  breakerAmps: positive.max(10000).default(20),
  connectorAmps: positive.max(10000).default(20),
  trimHeightM: z.number().finite().min(0).max(1000).default(0),
  sourceDistanceM: z.number().finite().min(0).max(10000).default(0),
  slackPercent: z.number().finite().min(0).max(100).default(10),
  audienceDistanceM: optional.default(null),
  mount: z.enum(["flown", "stacked"]).default("stacked"),
  hangingPoints: whole.max(5000).nullable().default(null),
  pointCapacityKg: optional.default(null),
  priority: z.enum(["vertical", "horizontal"]).default("vertical"),
  start: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).default("bottom-left"),
  mains: z.enum(["start-edge", "continuous"]).default("start-edge"),
  dataMode: z.enum(["auto", "manual"]).default("auto"),
  powerMode: z.enum(["auto", "manual"]).default("auto"),
  manualData: runs.default([]),
  manualPower: runs.default([]),
});
export type LedPlannerConfig = z.infer<typeof ledPlannerSchema>;
export type LedGeometry = z.infer<typeof ledGeometrySchema>;
