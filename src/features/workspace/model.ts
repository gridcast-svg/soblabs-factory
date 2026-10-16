import { z } from "zod";
import { avGeometrySchema, avLibrarySchema, avPointSchema, avWireSchema } from "./av-schema";
import { accountSchema, contactSchema, dealSchema, activitySchema } from "./crm-model";
export type { Account, Contact, Deal, Activity } from "./crm-model";

const finite = z.number().finite();
const money = finite.nonnegative().nullable();
const port = z.object({
  id: z.string(),
  label: z.string(),
  direction: z.enum(["input", "output", "bidirectional"]),
  connector: z.string(),
});
export const itemSchema = z.object({
  id: z.string().min(1),
  area: z.string(),
  scope: z.enum(["Selected", "Alternative", "Excluded"]),
  category: z.string(),
  manufacturer: z.string(),
  partNumber: z.string(),
  description: z.string().min(1),
  supplier: z.string(),
  sku: z.string(),
  quantity: finite.nonnegative(),
  unit: z.string(),
  unitCost: money,
  currency: z.enum(["CAD", "USD"]),
  fx: finite.positive().nullable(),
  markup: finite.nonnegative(),
  taxable: z.boolean(),
  leadDays: finite.nonnegative().nullable(),
  notes: z.string(),
  drawingRequired: z.boolean(),
  ports: z.array(port),
  rackU: finite.int().min(0).max(48),
});
export type BomItem = z.infer<typeof itemSchema>;
const deviceSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  label: z.string(),
  x: finite,
  y: finite,
  rackStart: finite.int().min(1).max(48).nullable(),
  location: z.string().optional(),
  avGeometry: avGeometrySchema.optional(),
  avTemplateId: z.string().optional(),
});
export type Device = z.infer<typeof deviceSchema>;
const connectionSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourcePort: z.string(),
  target: z.string(),
  targetPort: z.string(),
  cableType: z.string(),
  label: z.string(),
  lengthM: finite.positive().nullable(),
  bomItemId: z.string().nullable(),
  route: z
    .object({ mode: z.enum(["auto", "manual"]), points: z.array(avPointSchema).max(2000) })
    .optional(),
});
export type Connection = z.infer<typeof connectionSchema>;
const drawingSetSchema = z
  .object({
    id: z.string().min(1),
    sourceProjectId: z.string().min(1),
    projectName: z.string(),
    customer: z.string(),
    title: z.string().trim().min(1).max(200),
    drawingNumber: z.string().trim().min(1).max(80),
    drawingRevision: z.number().int().positive(),
    bomName: z.string().trim().min(1).max(200),
    bomSnapshotId: z.string().min(1),
    bomRevision: z.number().int().positive(),
    currency: z.enum(["CAD", "USD"]),
    taxRate: finite.min(0).max(100),
    createdAt: z.string().datetime(),
    notes: z.string().max(4000),
    items: z.array(itemSchema),
    devices: z.array(deviceSchema),
    connections: z.array(connectionSchema),
    avDrafts: z.array(avWireSchema).default([]),
  })
  .superRefine((drawing, ctx) => {
    for (const entries of [drawing.items, drawing.devices, drawing.connections]) {
      if (new Set(entries.map((x) => x.id)).size !== entries.length)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate saved drawing record IDs",
        });
    }
    for (const device of drawing.devices) {
      if (!drawing.items.some((item) => item.id === device.itemId))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Saved drawing refers to a missing BOM item",
        });
    }
    validateAvDrafts(drawing, ctx);
    for (const connection of drawing.connections) {
      for (const [deviceId, portId] of [
        [connection.source, connection.sourcePort],
        [connection.target, connection.targetPort],
      ]) {
        const device = drawing.devices.find((d) => d.id === deviceId);
        if (
          !drawing.items
            .find((i) => i.id === device?.itemId)
            ?.ports.some((port) => port.id === portId)
        )
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Saved drawing refers to a missing device or port",
          });
      }
      if (connection.bomItemId && !drawing.items.some((i) => i.id === connection.bomItemId))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Saved drawing refers to a missing cable item",
        });
    }
  });
export type DrawingSet = z.infer<typeof drawingSetSchema>;
const meetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceName: z.string(),
  text: z.string(),
  status: z.enum(["Needs review", "Reviewed"]),
  importedAt: z.string(),
});
export type Meeting = z.infer<typeof meetingSchema>;
const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  owner: z.string(),
  due: z.string(),
  done: z.boolean(),
  sourceMeetingId: z.string().nullable(),
});
export type Task = z.infer<typeof taskSchema>;
const ledSchema = z.object({
  width: finite.positive(),
  height: finite.positive(),
  cabinetWidth: finite.positive(),
  cabinetHeight: finite.positive(),
  pixelWidth: finite.int().positive(),
  pixelHeight: finite.int().positive(),
  costPerSqm: money,
});
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  customer: z.string(),
  accountId: z.string().nullable().default(null),
  stage: z.enum(["Discovery", "Design", "Proposal", "Procurement", "Installation", "Complete"]),
  currency: z.enum(["CAD", "USD"]),
  taxRate: finite.min(0).max(100),
  revision: z.number().int().positive(),
  items: z.array(itemSchema),
  devices: z.array(deviceSchema),
  connections: z.array(connectionSchema),
  avDrafts: z.array(avWireSchema).default([]),
  avLibrary: avLibrarySchema.nullable().default(null),
  drawingSets: z.array(drawingSetSchema).default([]),
  meetings: z.array(meetingSchema),
  tasks: z.array(taskSchema),
  led: ledSchema,
});
export type Project = z.infer<typeof projectSchema>;
export const stateSchema = z
  .object({
    version: z.literal(1),
    projects: z.array(projectSchema).min(1),
    contacts: z.array(contactSchema),
    accounts: z.array(accountSchema).default([]),
    deals: z.array(dealSchema).default([]),
    activities: z.array(activitySchema).default([]),
  })
  .superRefine((state, ctx) => {
    for (const [label, entries] of [
      ["projects", state.projects],
      ["contacts", state.contacts],
      ["accounts", state.accounts],
      ["deals", state.deals],
      ["activities", state.activities],
    ] as const) {
      if (new Set(entries.map((x) => x.id)).size !== entries.length)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate ${label} IDs` });
    }
    const check = (value: string | null, entries: { id: string }[], label: string) => {
      if (value && !entries.some((x) => x.id === value))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing linked ${label}` });
    };
    for (const c of state.contacts) check(c.accountId, state.accounts, "account");
    for (const d of state.deals) {
      check(d.accountId, state.accounts, "account");
      check(d.contactId, state.contacts, "contact");
      check(d.projectId, state.projects, "project");
    }
    for (const a of state.activities) {
      check(a.accountId, state.accounts, "account");
      check(a.contactId, state.contacts, "contact");
      check(a.dealId, state.deals, "deal");
      check(a.projectId, state.projects, "project");
    }
    const zohoIds = state.accounts
      .filter((a) => a.source === "Zoho" && a.sourceId)
      .map((a) => a.sourceId);
    if (new Set(zohoIds).size !== zohoIds.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate Zoho account IDs" });
    for (const p of state.projects) {
      validateAvDrafts(p, ctx);
      if (new Set(p.drawingSets.map((d) => d.id)).size !== p.drawingSets.length)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate drawing set IDs" });
      if (
        new Set(
          p.drawingSets.map((d) => `${d.drawingNumber.toUpperCase()}\u0000${d.drawingRevision}`),
        ).size !== p.drawingSets.length
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate drawing number and revision",
        });
      for (const drawing of p.drawingSets)
        if (drawing.sourceProjectId !== p.id)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Drawing set belongs to a different project",
          });
      const snapshots = new Map<string, string>();
      for (const drawing of p.drawingSets) {
        const value = JSON.stringify([
          drawing.bomName,
          drawing.bomRevision,
          drawing.currency,
          drawing.taxRate,
          drawing.items,
        ]);
        const previous = snapshots.get(drawing.bomSnapshotId);
        if (previous && previous !== value)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "BOM snapshot has conflicting saved contents",
          });
        snapshots.set(drawing.bomSnapshotId, value);
      }
      check(p.accountId, state.accounts, "account");
      for (const entries of [p.items, p.devices, p.connections, p.meetings, p.tasks])
        if (new Set(entries.map((x) => x.id)).size !== entries.length)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate project record IDs" });
      for (const d of p.devices)
        if (!p.items.some((i) => i.id === d.itemId))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Device refers to a missing BOM item",
          });
      for (const c of p.connections) {
        for (const [id, portId] of [
          [c.source, c.sourcePort],
          [c.target, c.targetPort],
        ]) {
          const d = p.devices.find((d) => d.id === id);
          const i = p.items.find((i) => i.id === d?.itemId);
          if (!i?.ports.some((port) => port.id === portId))
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Connection refers to a missing device or port",
            });
        }
        if (c.bomItemId && !p.items.some((i) => i.id === c.bomItemId))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Connection refers to a missing cable item",
          });
      }
    }
  });
export type WorkspaceState = z.infer<typeof stateSchema>;
export const uid = () => crypto.randomUUID();
export function blankItem(): BomItem {
  return {
    id: uid(),
    area: "Main system",
    scope: "Selected",
    category: "Equipment",
    manufacturer: "",
    partNumber: "",
    description: "New component",
    supplier: "",
    sku: "",
    quantity: 1,
    unit: "ea",
    unitCost: null,
    currency: "CAD",
    fx: 1,
    markup: 25,
    taxable: true,
    leadDays: null,
    notes: "",
    drawingRequired: true,
    ports: [],
    rackU: 0,
  };
}
export function blankProject(name = "Untitled project"): Project {
  return {
    id: uid(),
    name,
    customer: "",
    accountId: null,
    stage: "Discovery",
    currency: "CAD",
    taxRate: 0,
    revision: 1,
    items: [],
    devices: [],
    connections: [],
    avDrafts: [],
    avLibrary: null,
    drawingSets: [],
    meetings: [],
    tasks: [],
    led: {
      width: 6000,
      height: 3000,
      cabinetWidth: 500,
      cabinetHeight: 500,
      pixelWidth: 256,
      pixelHeight: 256,
      costPerSqm: null,
    },
  };
}
export function exampleState(): WorkspaceState {
  const p = blankProject("LED wall · design study");
  p.customer = "Example customer";
  p.stage = "Design";
  const player = {
    ...blankItem(),
    id: "player",
    description: "Example media player",
    category: "Computing",
    rackU: 1,
    ports: [{ id: "hdmi-out", label: "HDMI OUT", direction: "output" as const, connector: "HDMI" }],
  };
  const processor = {
    ...blankItem(),
    id: "processor",
    description: "Example LED processor",
    category: "Processing",
    rackU: 2,
    ports: [
      { id: "hdmi-in", label: "HDMI IN", direction: "input" as const, connector: "HDMI" },
      { id: "data-out", label: "LED DATA", direction: "output" as const, connector: "RJ45" },
    ],
  };
  const wall = {
    ...blankItem(),
    id: "wall",
    description: "Example LED cabinet",
    category: "LED",
    quantity: 72,
    rackU: 0,
    ports: [{ id: "data-in", label: "DATA IN", direction: "input" as const, connector: "RJ45" }],
  };
  p.items = [player, processor, wall];
  p.devices = [
    { id: "d-player", itemId: "player", label: "Media player 01", x: 70, y: 100, rackStart: 4 },
    {
      id: "d-processor",
      itemId: "processor",
      label: "LED processor 01",
      x: 390,
      y: 100,
      rackStart: 1,
    },
  ];
  p.connections = [
    {
      id: "c-hdmi",
      source: "d-player",
      sourcePort: "hdmi-out",
      target: "d-processor",
      targetPort: "hdmi-in",
      label: "C-001",
      cableType: "HDMI",
      lengthM: null,
      bomItemId: null,
    },
  ];
  p.tasks = [
    {
      id: uid(),
      title: "Verify processor capacity and cabinet compatibility",
      owner: "",
      due: "",
      done: false,
      sourceMeetingId: null,
    },
  ];
  return stateSchema.parse({ version: 1, projects: [p], contacts: [] });
}
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function linePrice(i: BomItem, projectCurrency: string) {
  if (i.unitCost === null || i.fx === null || (i.currency === projectCurrency && i.fx !== 1))
    return null;
  const cost = round(i.quantity * i.unitCost * i.fx);
  const unitSell = round(i.unitCost * i.fx * (1 + i.markup / 100));
  const sell = round(i.quantity * unitSell);
  return { cost, sell, profit: round(sell - cost) };
}
export function totals(p: Project) {
  let cost = 0,
    sell = 0,
    tax = 0,
    incomplete = 0;
  for (const i of p.items.filter((i) => i.scope === "Selected")) {
    const x = linePrice(i, p.currency);
    if (!x) {
      incomplete++;
      continue;
    }
    cost += x.cost;
    sell += x.sell;
    if (i.taxable) tax += round((x.sell * p.taxRate) / 100);
  }
  return {
    cost: round(cost),
    sell: round(sell),
    tax: round(tax),
    profit: round(sell - cost),
    total: round(sell + tax),
    incomplete,
  };
}
export function reconcile(p: Project): string[] {
  const issues: string[] = [];
  if (p.avDrafts.length)
    issues.push(`${p.avDrafts.length} unfinished cables: connect both ends before construction`);
  const labels = new Set<string>();
  for (const cable of p.connections) {
    const label = cable.label.trim().toUpperCase();
    if (!label) issues.push("A connection is missing its cable ID");
    else if (labels.has(label)) issues.push(`${cable.label}: duplicate cable ID`);
    labels.add(label);
  }
  for (const i of p.items.filter((i) => i.scope === "Selected" && i.drawingRequired)) {
    const n = p.devices.filter((d) => d.itemId === i.id).length;
    if (n !== i.quantity) issues.push(`${i.description}: ${n} drawn / ${i.quantity} in BOM`);
  }
  for (const d of p.devices) {
    const i = p.items.find((i) => i.id === d.itemId);
    if (i?.scope !== "Selected") issues.push(`${d.label}: BOM item is ${i?.scope.toLowerCase()}`);
  }
  for (const c of p.connections) {
    const sd = p.devices.find((d) => d.id === c.source),
      td = p.devices.find((d) => d.id === c.target);
    const sp = p.items.find((i) => i.id === sd?.itemId)?.ports.find((x) => x.id === c.sourcePort),
      tp = p.items.find((i) => i.id === td?.itemId)?.ports.find((x) => x.id === c.targetPort);
    if (!sp?.connector || !tp?.connector)
      issues.push(`${c.label}: connector specification missing`);
    else if (sp.connector !== tp.connector)
      issues.push(`${c.label}: different connectors; verify adapter or converter`);
    if (sp?.direction === "input" || tp?.direction === "output")
      issues.push(`${c.label}: port direction requires review`);
    const i = p.items.find((i) => i.id === c.bomItemId);
    if (!i || i.scope !== "Selected") issues.push(`${c.label}: cable missing from selected BOM`);
    if (c.lengthM === null) issues.push(`${c.label}: cable length requires site verification`);
  }
  const use = new Map<string, number>();
  for (const c of p.connections) {
    if (c.bomItemId) use.set(c.bomItemId, (use.get(c.bomItemId) || 0) + 1);
  }
  for (const [id, n] of use) {
    const i = p.items.find((i) => i.id === id);
    if (i && i.unit === "ea" && i.quantity < n)
      issues.push(`${i.description}: ${n} connections / ${i.quantity} cables in BOM`);
  }
  const occupied = new Map<number, string>();
  for (const d of p.devices) {
    const i = p.items.find((i) => i.id === d.itemId);
    if (d.rackStart === null || !i?.rackU) continue;
    for (let u = d.rackStart; u < d.rackStart + i.rackU; u++) {
      if (u > 42) issues.push(`${d.label}: exceeds 42U rack`);
      else if (occupied.has(u)) issues.push(`Rack U${u}: ${d.label} overlaps ${occupied.get(u)}`);
      else occupied.set(u, d.label);
    }
  }
  return issues;
}
export function removeItem(p: Project, id: string): Project {
  const deviceIds = new Set(p.devices.filter((d) => d.itemId === id).map((d) => d.id));
  return {
    ...p,
    items: p.items.filter((i) => i.id !== id),
    devices: p.devices.filter((d) => !deviceIds.has(d.id)),
    connections: p.connections
      .filter((c) => !deviceIds.has(c.source) && !deviceIds.has(c.target))
      .map((c) => (c.bomItemId === id ? { ...c, bomItemId: null } : c)),
    avDrafts: p.avDrafts
      .filter((c) => !deviceIds.has(c.source) && !deviceIds.has(c.target))
      .map((c) => (c.data.bomItemId === id ? { ...c, data: { ...c.data, bomItemId: null } } : c)),
  };
}

function validateAvDrafts(
  design: {
    items: BomItem[];
    devices: Device[];
    connections: Connection[];
    avDrafts: z.infer<typeof avWireSchema>[];
  },
  ctx: z.RefinementCtx,
) {
  const ids = [...design.connections.map((c) => c.id), ...design.avDrafts.map((c) => c.id)];
  if (new Set(ids).size !== ids.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate cable record IDs" });
  for (const item of design.items)
    if (new Set(item.ports.map((port) => port.id)).size !== item.ports.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate equipment port IDs" });
  for (const cable of design.avDrafts) {
    if ((!cable.source && !cable.target) || (cable.source && cable.target))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An unfinished cable needs exactly one connected end",
      });
    for (const [id, portId] of [
      [cable.source, cable.sourcePort],
      [cable.target, cable.targetPort],
    ]) {
      if (!id) continue;
      const device = design.devices.find((d) => d.id === id);
      if (
        !design.items.find((i) => i.id === device?.itemId)?.ports.some((port) => port.id === portId)
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unfinished cable refers to a missing device or port",
        });
    }
    if (cable.data.bomItemId && !design.items.some((item) => item.id === cable.data.bomItemId))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unfinished cable refers to a missing BOM item",
      });
  }
}
