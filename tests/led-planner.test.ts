import { test } from "node:test";
import assert from "node:assert/strict";
import { blankProject, stateSchema, exampleState } from "../src/features/workspace/model";
import {
  calculateLedPlan,
  applyLedBom,
  saveLedDesign,
} from "../src/features/workspace/led-planner";
import { ledPlannerSchema } from "../src/features/workspace/led-schema";
import { planRoutes, START_CORNERS } from "../src/vendor/calculator-led-pro/routing/serpentine";
import { ledCableCsv } from "../src/features/workspace/led-export";

function fixture() {
  const p = blankProject("Synthetic LED installation");
  p.led = {
    width: 4000,
    height: 2500,
    cabinetWidth: 500,
    cabinetHeight: 500,
    pixelWidth: 100,
    pixelHeight: 100,
    costPerSqm: null,
  };
  p.ledPlanner = ledPlannerSchema.parse({
    weightKg: 10,
    maxPowerW: 200,
    typicalPowerW: 80,
    pixelsPerPort: 110000,
    dataPorts: 4,
    processorPixels: 400000,
    canvasWidth: 4000,
    canvasHeight: 4000,
    sourceDistanceM: 10,
    trimHeightM: 2,
    slackPercent: 10,
  });
  return p;
}
test("legacy workspace backups retain geometry and acquire unknown specifications", () => {
  const original = exampleState();
  const old = JSON.parse(JSON.stringify(original));
  delete old.projects[0].ledPlanner;
  delete old.projects[0].ledDesigns;
  const restored = stateSchema.parse(old).projects[0]!;
  assert.deepEqual(restored.led, original.projects[0]!.led);
  assert.equal(restored.ledPlanner.maxPowerW, null);
  assert.equal(restored.ledPlanner.voltage, 120);
  assert.deepEqual(restored.ledDesigns, []);
  const plan = calculateLedPlan(restored.led, restored.ledPlanner);
  assert.equal(plan.electrical, null);
  assert.equal(plan.demand, null);
  assert.deepEqual(plan.dataRuns, []);
  assert.equal(plan.layout!.weightKg, null);
});
test("wall-fit stays inside the wall; count mode uses exact cabinet pixels and enforces the grid limit", () => {
  const p = fixture();
  p.led.width = 3999;
  p.led.height = 2499;
  let plan = calculateLedPlan(p.led, p.ledPlanner);
  assert.equal(plan.layout!.cabinets, 28);
  assert.equal(plan.layout!.widthMm, 3500);
  assert.equal(plan.layout!.heightMm, 2000);
  p.ledPlanner.mode = "count";
  p.ledPlanner.columns = 8;
  p.ledPlanner.rows = 5;
  plan = calculateLedPlan(p.led, p.ledPlanner);
  assert.equal(plan.layout!.pixelWidth, 800);
  assert.equal(plan.layout!.cabinets, 40);
  p.ledPlanner.columns = 5000;
  assert.equal(calculateLedPlan(p.led, p.ledPlanner).layout, null);
  p.ledPlanner.mode = "wall";
  p.led.width = 1;
  assert.equal(calculateLedPlan(p.led, p.ledPlanner).layout, null);
});
test("all eight route patterns and both main policies cover each cabinet once within capacity", () => {
  for (const priority of ["vertical", "horizontal"] as const)
    for (const start of START_CORNERS)
      for (const mains of ["start-edge", "continuous"] as const)
        for (const capacity of [1, 3, 7, 11, 40]) {
          const runs = planRoutes({ cols: 8, rows: 5, capacity, priority, start, mains });
          assert.equal(runs.flat().length, 40);
          assert.equal(new Set(runs.flat().map((p) => `${p.x}:${p.y}`)).size, 40);
          for (const run of runs) {
            assert.ok(run.length <= capacity);
            for (let n = 1; n < run.length; n++)
              assert.equal(
                Math.abs(run[n]!.x - run[n - 1]!.x) + Math.abs(run[n]!.y - run[n - 1]!.y),
                1,
              );
          }
        }
});
test("routing, schedules, electrical derating and processor count use the drawn runs", () => {
  const p = fixture(),
    plan = calculateLedPlan(p.led, p.ledPlanner);
  assert.equal(plan.layout!.cabinets, 40);
  assert.equal(plan.layout!.weightKg, 400);
  assert.equal(plan.dataCapacity, 11);
  assert.equal(plan.powerCapacity, 9);
  assert.equal(plan.dataRuns.length, 4);
  assert.equal(plan.powerRuns.length, 8);
  assert.equal(plan.electrical!.maximumW, 8000);
  assert.equal(plan.electrical!.usableAmps, 16);
  assert.equal(plan.dataSchedule!.totalMains, 4);
  assert.equal(plan.dataSchedule!.totalJumpers, 36);
  assert.deepEqual(plan.dataSchedule!.mainsByLength, [{ lengthM: 15, count: 4 }]);
  assert.equal(plan.demand!.processorsNeeded, 1);
  p.ledPlanner.processorPixels = 200000;
  assert.equal(calculateLedPlan(p.led, p.ledPlanner).demand!.processorsNeeded, 2);
  p.ledPlanner.canvasWidth = 300;
  p.ledPlanner.canvasHeight = 200;
  assert.equal(calculateLedPlan(p.led, p.ledPlanner).demand!.processorsNeeded, 9);
  assert.equal(ledCableCsv(p).split("\r\n").length, 13);
});
test("undersized ports and circuits never gain a fictitious one-cabinet capacity", () => {
  const p = fixture();
  p.ledPlanner.pixelsPerPort = 9999;
  p.ledPlanner.maxPowerW = 2000;
  const plan = calculateLedPlan(p.led, p.ledPlanner);
  assert.equal(plan.dataCapacity, 0);
  assert.equal(plan.powerCapacity, 0);
  assert.deepEqual(plan.dataRuns, []);
  assert.deepEqual(plan.powerRuns, []);
  assert.throws(() => applyLedBom(p), /Resolve/);
});
test("incomplete, duplicate, oversized and resized manual paths cannot update material quantities", () => {
  const p = fixture();
  p.ledPlanner.dataMode = "manual";
  for (const manual of [
    [],
    [
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
    ],
    [[{ x: 99, y: 99 }]],
    [
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    ],
  ]) {
    p.ledPlanner.manualData = manual;
    assert.ok(calculateLedPlan(p.led, p.ledPlanner).routeErrors.length);
    assert.throws(() => applyLedBom(p), /Resolve/);
  }
});
test("BOM generation is idempotent, keeps manual prices and records obsolete generated lines without breaking references", () => {
  let p = applyLedBom(fixture());
  assert.equal(p.items.find((i) => i.id === `led-generated-${p.id}`)!.quantity, 40);
  const main = p.items.find((i) => i.description === "LED data main · 15m")!;
  main.unitCost = 123;
  main.currency = "USD";
  main.fx = 1.4;
  main.sku = "KEEP-ME";
  main.ports = [{ id: "in", label: "IN", direction: "input", connector: "RJ45" }];
  p.devices.push({
    id: "preserved-device",
    itemId: main.id,
    label: "Cable on design",
    x: 1,
    y: 1,
    rackStart: null,
  });
  const count = p.items.length;
  p = applyLedBom(p);
  assert.equal(p.items.length, count);
  assert.equal(p.items.find((i) => i.id === main.id)!.unitCost, 123);
  assert.equal(p.items.find((i) => i.id === main.id)!.currency, "USD");
  p.ledPlanner.sourceDistanceM = 25;
  p = applyLedBom(p);
  const stale = p.items.find((i) => i.id === main.id)!;
  assert.equal(stale.scope, "Excluded");
  assert.equal(stale.quantity, 0);
  assert.equal(stale.sku, "KEEP-ME");
  assert.equal(p.devices[0]!.itemId, main.id);
  stateSchema.parse({ version: 1, projects: [p], contacts: [] });
});
test("over-range mains and declared rigging overloads block material updates", () => {
  const p = fixture();
  p.ledPlanner.sourceDistanceM = 100;
  assert.ok(calculateLedPlan(p.led, p.ledPlanner).dataSchedule!.beyondLongestCable);
  assert.throws(() => applyLedBom(p), /Resolve/);
  p.ledPlanner.sourceDistanceM = 10;
  p.ledPlanner.pointCapacityKg = 30;
  assert.ok(calculateLedPlan(p.led, p.ledPlanner).rigging!.overCapacity);
  assert.throws(() => applyLedBom(p), /Resolve/);
});
test("saved designs retain isolated layouts, routes, project identity and versioned BOM snapshots", () => {
  let p = applyLedBom(fixture());
  p = saveLedDesign(p, "First design");
  const first = structuredClone(p.ledDesigns[0]!);
  p.led.width = 3000;
  p.name = "Renamed project";
  p = saveLedDesign(p, "Layout alternative");
  assert.equal(p.ledDesigns[1]!.bomSnapshotId, first.bomSnapshotId);
  p = applyLedBom(p);
  p = saveLedDesign(p, "Updated BOM");
  assert.equal(p.ledDesigns[2]!.bomRevision, 2);
  assert.notEqual(p.ledDesigns[2]!.bomSnapshotId, first.bomSnapshotId);
  p.items[0]!.quantity = 999;
  p.ledPlanner.manualData.push([{ x: 0, y: 0 }]);
  assert.deepEqual(p.ledDesigns[0], first);
  const parsed = stateSchema.parse(
    JSON.parse(JSON.stringify({ version: 1, projects: [p], contacts: [] })),
  );
  assert.deepEqual(parsed.projects[0]!.ledDesigns[0], first);
});

test("pixel-pitch targets round to whole cabinet pixels without inventing brightness", async () => {
  const { geometryForPitch } = await import("../src/features/workspace/led-specification");
  const p = blankProject();
  const g = geometryForPitch(p.led, 2.5);
  assert.equal(g.pixelWidth, 200);
  assert.equal(g.pixelHeight, 200);
  const rounded = geometryForPitch({ ...g, cabinetHeight: 250 }, 1.875);
  assert.equal(rounded.pixelWidth, 267);
  assert.equal(rounded.pixelHeight, 133);
  assert.equal(p.ledPlanner.brightnessNits, null);
  for (const pitch of [0, -1, Infinity, 101]) assert.throws(() => geometryForPitch(g, pitch));
  p.led = g;
  p.ledPlanner = { ...p.ledPlanner, requestedPitchMm: 2.5, brightnessNits: 1200, refreshHz: 3840 };
  const saved = saveLedDesign(p, "P2.5 specification");
  assert.equal(saved.ledDesigns[0]!.config.brightnessNits, 1200);
  assert.equal(saved.ledDesigns[0]!.geometry.pixelWidth, 200);
});
