import { z } from "zod";
const positive = z.number().finite().min(0.001);
const title = z.string().trim().min(1).max(120);
const source = z.string().max(1000).default("");
export const projectionProjectorSchema = z
  .object({
    id: title,
    brand: z.string().max(120).default(""),
    model: title,
    mount: title,
    nativeWidth: positive.int().max(32768),
    nativeHeight: positive.int().max(32768),
    lumens: positive.max(1000000).nullable().default(null),
    lensIncluded: z.boolean().default(false),
    source,
    verified: z.boolean().default(false),
  })
  .refine(
    (p) => !p.verified || !!p.source.trim(),
    "Provide a specification source before marking a projector verified.",
  );
export const projectionLensSchema = z
  .object({
    id: title,
    name: title,
    mount: title,
    throwRatioMin: positive.max(100),
    throwRatioMax: positive.max(100),
    hShiftPct: z.number().finite().min(0).max(500).nullable().default(null),
    vShiftPct: z.number().finite().min(0).max(500).nullable().default(null),
    source,
    verified: z.boolean().default(false),
  })
  .refine(
    (l) => l.throwRatioMin <= l.throwRatioMax,
    "Wide throw ratio must not exceed tele throw ratio.",
  )
  .refine(
    (l) => !l.verified || !!l.source.trim(),
    "Provide a specification source before marking a lens verified.",
  );
export const projectionLibrarySchema = z
  .object({
    projectors: z.array(projectionProjectorSchema).max(200).default([]),
    lenses: z.array(projectionLensSchema).max(500).default([]),
  })
  .superRefine((library, ctx) => {
    for (const entries of [library.projectors, library.lenses])
      if (new Set(entries.map((e) => e.id)).size !== entries.length)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate projection equipment IDs",
        });
  });
export const projectionConfigSchema = z
  .object({
    units: z.enum(["metric", "imperial"]).default("metric"),
    kind: z.enum(["flat", "cylindrical"]).default("flat"),
    widthM: positive.max(1000).default(8),
    heightM: positive.max(1000).default(2.5),
    radiusM: positive.max(100000).default(10),
    gain: positive.max(10).default(1),
    columns: positive.int().max(32).default(2),
    rows: positive.int().max(32).default(1),
    fitMode: z.enum(["fit-width", "fit-height", "manual"]).default("fit-width"),
    hOverlap: z.number().finite().min(0).max(0.5).default(0.2),
    vOverlap: z.number().finite().min(0).max(0.5).default(0.2),
    placement: z.enum(["per-tile", "common-point"]).default("per-tile"),
    throwDistanceM: positive.max(1000).default(6),
    projectorId: title.nullable().default(null),
    lensId: title.nullable().default(null),
    includeScreen: z.boolean().default(false),
  })
  .refine((c) => c.columns * c.rows <= 256, "Use 256 projectors or fewer.");
export type ProjectionConfig = z.infer<typeof projectionConfigSchema>;
export type ProjectionLibrary = z.infer<typeof projectionLibrarySchema>;
export type ProjectionProjector = z.infer<typeof projectionProjectorSchema>;
export type ProjectionLens = z.infer<typeof projectionLensSchema>;
