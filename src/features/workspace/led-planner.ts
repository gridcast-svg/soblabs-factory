import { buildLayout, fitToWall } from "@/lib/led-calc";
import { cabinetsPerDataPort } from "@/vendor/calculator-led-pro/led-array/geometry";
import { viewingAdvice } from "@/vendor/calculator-led-pro/led-array/viewing";
import {
  effectiveAmpsPerLine,
  cabinetsPerPowerCircuit,
} from "@/vendor/calculator-led-pro/electrical/load";
import { riggingLoad } from "@/vendor/calculator-led-pro/rigging/load";
import { planRoutes, type GridPosition } from "@/vendor/calculator-led-pro/routing/serpentine";
import { routingDemand } from "@/vendor/calculator-led-pro/routing/demand";
import { cableSchedule } from "@/vendor/calculator-led-pro/routing/schedule";
import { blankItem, uid, type BomItem, type Project, type LedDesign } from "./model";
import type { LedGeometry, LedPlannerConfig } from "./led-schema";

export type LedLayer = "data" | "power";
export const MAX_LED_CABINETS = 5000;

function routeIssues(
  runs: GridPosition[][],
  cols: number,
  rows: number,
  capacity: number,
  name: string,
) {
  const issues: string[] = [];
  const used = new Set<string>();
  for (const [index, run] of runs.entries()) {
    if (run.length > capacity)
      issues.push(`${name} run ${index + 1} exceeds capacity (${run.length}/${capacity}).`);
    for (const [n, cell] of run.entries()) {
      const key = `${cell.x}:${cell.y}`;
      if (cell.x < 0 || cell.y < 0 || cell.x >= cols || cell.y >= rows)
        issues.push(`${name}: a routed cabinet is outside the current grid.`);
      if (used.has(key)) issues.push(`${name}: a cabinet is assigned more than once.`);
      used.add(key);
      const previous = run[n - 1];
      if (previous && Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y) !== 1)
        issues.push(`${name} run ${index + 1} has a non-adjacent jumper.`);
    }
  }
  if (used.size !== cols * rows)
    issues.push(`${name}: ${used.size}/${cols * rows} cabinets routed.`);
  return [...new Set(issues)];
}

export function calculateLedPlan(g: LedGeometry, c: LedPlannerConfig) {
  const cabinet = {
    widthMm: g.cabinetWidth,
    heightMm: g.cabinetHeight,
    depthMm: null,
    pixelWidth: g.pixelWidth,
    pixelHeight: g.pixelHeight,
    weightKg: c.weightKg,
    powerTypicalW: c.typicalPowerW,
    powerMaxW: c.maxPowerW,
  };
  const cols = c.mode === "count" ? c.columns : Math.floor(g.width / g.cabinetWidth);
  const rows = c.mode === "count" ? c.rows : Math.floor(g.height / g.cabinetHeight);
  const issues: string[] = [];
  if (cols < 1 || rows < 1 || cols * rows > MAX_LED_CABINETS) {
    return {
      layout: null,
      issues: [
        cols * rows > MAX_LED_CABINETS
          ? "Choose a layout of 5,000 cabinets or fewer."
          : "Not even one cabinet fits within the available wall dimensions.",
      ],
      dataRuns: [],
      powerRuns: [],
      dataCapacity: null,
      powerCapacity: null,
      electrical: null,
      demand: null,
      rigging: null,
      viewing: null,
      dataSchedule: null,
      powerSchedule: null,
      routeErrors: [] as string[],
    };
  }
  const layout =
    c.mode === "count"
      ? buildLayout(cabinet, cols, rows)
      : fitToWall(cabinet, g.width, g.height).layout!;
  let dataCapacity: number | null = null;
  if (c.pixelsPerPort !== null) {
    dataCapacity =
      c.pixelsPerPort < g.pixelWidth * g.pixelHeight
        ? 0
        : cabinetsPerDataPort({
            maxPixelsPerPort: c.pixelsPerPort,
            cabinet: { resX: g.pixelWidth, resY: g.pixelHeight },
          });
    if (!dataCapacity) issues.push("One cabinet exceeds the processor's per-port pixel capacity.");
  } else issues.push("Enter verified pixels per data port to plan data routing.");

  const usableAmps = effectiveAmpsPerLine({
    breakerAmps: c.breakerAmps,
    cableLoopAmps: c.connectorAmps,
  });
  let powerCapacity: number | null = null;
  if (c.maxPowerW !== null) {
    powerCapacity =
      c.maxPowerW > c.voltage * usableAmps
        ? 0
        : cabinetsPerPowerCircuit({
            voltage: c.voltage,
            ampsPerLine: usableAmps,
            cabinetMaxPowerW: c.maxPowerW,
          });
    if (!powerCapacity) issues.push("One cabinet exceeds the declared power circuit capacity.");
  } else issues.push("Enter maximum cabinet power to plan power routing.");
  if (c.typicalPowerW !== null && c.maxPowerW !== null && c.typicalPowerW > c.maxPowerW)
    issues.push("Typical cabinet power exceeds maximum cabinet power.");

  const routes = (capacity: number | null, mode: "auto" | "manual", manual: GridPosition[][]) =>
    !capacity
      ? []
      : mode === "manual"
        ? manual
        : planRoutes({
            cols,
            rows,
            capacity,
            priority: c.priority,
            start: c.start,
            mains: c.mains,
          });
  const dataRuns = routes(dataCapacity, c.dataMode, c.manualData);
  const powerRuns = routes(powerCapacity, c.powerMode, c.manualPower);
  const routeErrors = [
    ...(dataCapacity ? routeIssues(dataRuns, cols, rows, dataCapacity, "Data") : []),
    ...(powerCapacity ? routeIssues(powerRuns, cols, rows, powerCapacity, "Power") : []),
  ];
  issues.push(...routeErrors);
  const completeProcessor = c.dataPorts && c.processorPixels && c.canvasWidth && c.canvasHeight;
  const demand =
    completeProcessor && dataCapacity && !routeErrors.length
      ? routingDemand({
          dataRuns,
          powerRuns,
          dataPortsPerProcessor: c.dataPorts!,
          totalPixels: layout.totalPixels,
          maxPixelsPerProcessor: c.processorPixels!,
          resX: layout.pixelWidth,
          resY: layout.pixelHeight,
          maxCanvasWidth: c.canvasWidth!,
          maxCanvasHeight: c.canvasHeight!,
        })
      : null;
  if (!completeProcessor)
    issues.push(
      "Enter processor port count, total pixel capacity and canvas limits to estimate processor quantity.",
    );
  if (demand && demand.processorsNeeded > 1)
    issues.push(
      `At least ${demand.processorsNeeded} processors required by ${demand.processorLimit}; verify how the canvas and runs will be split.`,
    );
  const schedule = (runs: GridPosition[][]) =>
    cableSchedule({
      runs,
      cabinetWidthMm: g.cabinetWidth,
      cabinetHeightMm: g.cabinetHeight,
      rows,
      trimHeightM: c.trimHeightM,
      distanceToSourceM: c.sourceDistanceM,
      slack: c.slackPercent / 100,
    });
  const dataSchedule = dataCapacity && !routeErrors.length ? schedule(dataRuns) : null;
  const powerSchedule = powerCapacity && !routeErrors.length ? schedule(powerRuns) : null;
  if (dataSchedule?.beyondLongestCable || powerSchedule?.beyondLongestCable)
    issues.push(
      "A main exceeds the 50 m cable schedule range; specify a custom length or redesign the distribution.",
    );
  const rigging =
    c.weightKg === null
      ? null
      : riggingLoad({
          mount: c.mount,
          cols,
          rows,
          cabinetWeightKg: c.weightKg,
          points: c.hangingPoints,
          pointCapacityKg: c.pointCapacityKg,
        });
  if (rigging?.overCapacity)
    issues.push("Declared rigging load reaches or exceeds a rated limit; revise the design.");
  if (rigging && !rigging.evenlyDivided)
    issues.push(
      "Hanging points do not divide evenly across cabinet columns; load distribution requires review.",
    );
  const electrical =
    c.maxPowerW === null
      ? null
      : {
          maximumW: layout.cabinets * c.maxPowerW,
          typicalW: c.typicalPowerW === null ? null : layout.cabinets * c.typicalPowerW,
          maximumA: (layout.cabinets * c.maxPowerW) / c.voltage,
          usableAmps,
        };
  const viewing = viewingAdvice({
    pitchMm: Math.max(g.cabinetWidth / g.pixelWidth, g.cabinetHeight / g.pixelHeight),
    audienceDistanceM: c.audienceDistanceM,
  });
  return {
    layout,
    issues,
    dataRuns,
    powerRuns,
    dataCapacity,
    powerCapacity,
    electrical,
    demand,
    rigging,
    viewing,
    dataSchedule,
    powerSchedule,
    routeErrors,
  };
}
export type LedPlan = ReturnType<typeof calculateLedPlan>;

export function ledBomLines(p: Project): BomItem[] {
  const c = p.ledPlanner,
    plan = calculateLedPlan(p.led, c),
    l = plan.layout;
  if (!l) return [];
  const lines: BomItem[] = [];
  const line = (
    role: string,
    description: string,
    quantity: number,
    category: string,
    notes: string,
  ) => {
    const id = role === "cabinet" ? `led-generated-${p.id}` : `led-generated-${p.id}-${role}`;
    const previous = p.items.find((i) => i.id === id);
    const item: BomItem = {
      ...(previous ?? blankItem()),
      id,
      description,
      quantity,
      category,
      area: previous?.area ?? "LED display",
      scope: "Selected",
      drawingRequired: previous?.drawingRequired ?? false,
      currency: previous?.currency ?? p.currency,
      unit: "ea",
      notes,
    };
    lines.push(item);
    return item;
  };
  const cabinet = line(
    "cabinet",
    "LED cabinets · configured display",
    l.cabinets,
    "LED",
    `${l.columns} columns x ${l.rows} rows; ${l.widthMm} x ${l.heightMm} mm; ${l.pixelWidth} x ${l.pixelHeight} pixels. Specifications: ${c.specSource || "User-entered; source not supplied"}.`,
  );
  cabinet.manufacturer = c.cabinetManufacturer || cabinet.manufacturer;
  cabinet.partNumber = c.cabinetModel || cabinet.partNumber;
  if (p.led.costPerSqm !== null) {
    cabinet.unitCost =
      Math.round(((p.led.costPerSqm * p.led.cabinetWidth * p.led.cabinetHeight) / 1e6) * 100) / 100;
    cabinet.currency = p.currency;
    cabinet.fx = 1;
  }
  if (plan.demand)
    line(
      "processor",
      c.processorModel || "LED processor · model to specify",
      plan.demand.processorsNeeded,
      "Processing",
      "Estimated minimum from ports, total pixels and canvas limits. Verify partitioning, receiver compatibility and redundancy; these quantities do not establish compatibility.",
    );
  for (const layer of ["data", "power"] as const) {
    const schedule = layer === "data" ? plan.dataSchedule : plan.powerSchedule;
    if (!schedule || schedule.beyondLongestCable) continue;
    for (const main of schedule.mainsByLength)
      line(
        `${layer}-main-${main.lengthM}`,
        `LED ${layer} main · ${main.lengthM}m`,
        main.count,
        "Cabling",
        "Estimated rack-to-screen route including rise and slack. Verify connector, installed path, voltage drop and maximum signal distance.",
      );
    if (schedule.totalJumpers)
      line(
        `${layer}-jumper`,
        `LED ${layer} cabinet jumper`,
        schedule.totalJumpers,
        "Cabling",
        "One jumper between adjacent cabinets in each run; connector and actual length to specify.",
      );
  }
  return lines;
}

export function applyLedBom(p: Project): Project {
  const plan = calculateLedPlan(p.led, p.ledPlanner);
  if (
    !plan.layout ||
    plan.routeErrors.length ||
    plan.dataCapacity === 0 ||
    plan.powerCapacity === 0 ||
    plan.dataSchedule?.beyondLongestCable ||
    plan.powerSchedule?.beyondLongestCable ||
    plan.rigging?.overCapacity ||
    (p.ledPlanner.typicalPowerW !== null &&
      p.ledPlanner.maxPowerW !== null &&
      p.ledPlanner.typicalPowerW > p.ledPlanner.maxPowerW)
  )
    throw new Error("Resolve the LED plan errors before updating the BOM.");
  const lines = ledBomLines(p);
  const items = p.items.map((item) => {
    const updated = lines.find((i) => i.id === item.id);
    if (updated) return updated;
    if (item.id.startsWith(`led-generated-${p.id}-`))
      return {
        ...item,
        quantity: 0,
        scope: "Excluded" as const,
        notes:
          "No longer required by the current LED plan. Previous specification retained for review.",
      };
    return item;
  });
  for (const line of lines) if (!p.items.some((i) => i.id === line.id)) items.push(line);
  return { ...p, items };
}

export function saveLedDesign(p: Project, title: string): Project {
  if (!title.trim()) throw new Error("Name this LED design.");
  if (p.ledDesigns.length >= 50)
    throw new Error(
      "This project already has 50 saved LED designs. Export a workspace backup before removing an older design.",
    );
  if (!calculateLedPlan(p.led, p.ledPlanner).layout)
    throw new Error("Choose a valid layout before saving.");
  const previous = p.ledDesigns
    .slice()
    .reverse()
    .find(
      (d) =>
        JSON.stringify([d.currency, d.taxRate, d.items]) ===
        JSON.stringify([p.currency, p.taxRate, p.items]),
    );
  const design: LedDesign = {
    id: uid(),
    title: title.trim(),
    createdAt: new Date().toISOString(),
    bomRevision:
      previous?.bomRevision ?? Math.max(0, ...p.ledDesigns.map((d) => d.bomRevision)) + 1,
    bomSnapshotId: previous?.bomSnapshotId ?? uid(),
    projectName: p.name,
    customer: p.customer,
    currency: p.currency,
    taxRate: p.taxRate,
    geometry: structuredClone(p.led),
    config: structuredClone(p.ledPlanner),
    items: structuredClone(p.items),
  };
  return { ...p, ledDesigns: [...p.ledDesigns, design] };
}
