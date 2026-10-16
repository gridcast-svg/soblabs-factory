import { z } from "zod";

const text = z.string().max(2000);
export const avPointSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
export const avPortSchema = z.object({
  id: text,
  label: text,
  direction: z.enum(["input", "output"]),
  connectorType: text.optional(),
  factoryBidirectional: z.boolean().optional(),
});
export const avDataSchema = z.object({
  type: z.literal("device"),
  deviceId: text,
  manufacturer: text,
  model: text,
  category: text.optional(),
  location: text.optional(),
  factoryItemId: text.optional(),
  factoryTemplateId: text.optional(),
  ports: z.array(avPortSchema).max(500),
});
export const avGeometrySchema = z.object({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  ports: z
    .array(
      z.object({
        id: text,
        x: z.number().finite(),
        y: z.number().finite(),
        side: z.enum(["left", "right"]),
      }),
    )
    .max(500),
});
export const avNodeSchema = z.object({
  id: text,
  position: avPointSchema,
  data: avDataSchema,
  geometry: avGeometrySchema.optional(),
});
export const avWireSchema = z.object({
  id: text,
  source: text,
  sourcePort: text.optional(),
  target: text,
  targetPort: text.optional(),
  sourcePosition: avPointSchema.optional(),
  targetPosition: avPointSchema.optional(),
  routingMode: z.enum(["manual", "auto"]).optional(),
  points: z.array(avPointSchema).max(2000).optional(),
  data: z.object({
    type: z.literal("wire"),
    wireId: text,
    wireType: text.optional(),
    lengthM: z.number().finite().positive().nullable().optional(),
    bomItemId: text.nullable().optional(),
  }),
});
export const avLibrarySchema = z
  .array(z.object({ libraryId: text, template: avDataSchema }))
  .max(2000);
export const avDocumentSchema = z.object({
  nodes: z.array(avNodeSchema).max(5000),
  edges: z.array(avWireSchema).max(20000),
  library: avLibrarySchema.nullable(),
  bomLibrary: avLibrarySchema.optional(),
});
export type AvDocument = z.infer<typeof avDocumentSchema>;
