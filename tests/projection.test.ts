import { test } from "node:test";
import assert from "node:assert/strict";
import { blankProject, stateSchema } from "../src/features/workspace/model";
import {
  calculateProjection,
  applyProjectionBom,
  saveProjectionDesign,
  projectionArenaXml,
  importProjectionLibrary,
} from "../src/features/workspace/projection-planner";
import {
  projectionConfigSchema,
  projectionLibrarySchema,
} from "../src/features/workspace/projection-schema";
import {
  pixelBudget,
  tileForSpan,
  spanForTile,
  curvedFlatImageWidth,
} from "../src/vendor/blend-calc/lib/geometry";
import { fromMetres, toMetres } from "../src/vendor/blend-calc/lib/units";
import { projectionSvg } from "../src/features/workspace/projection-drawing";

function fixture() {
  const p = blankProject("Synthetic projection installation");
  p.projection = projectionConfigSchema.parse({ projectorId: "body", lensId: "lens" });
  p.projectionLibrary = projectionLibrarySchema.parse({
    projectors: [
      {
        id: "body",
        brand: "Synthetic",
        model: "TEST-WUXGA",
        mount: "test-mount",
        nativeWidth: 1920,
        nativeHeight: 1200,
        lumens: 20000,
        source: "Synthetic test fixture",
        verified: true,
      },
    ],
    lenses: [
      {
        id: "lens",
        name: "TEST-ZOOM",
        mount: "test-mount",
        throwRatioMin: 1.2,
        throwRatioMax: 1.8,
        hShiftPct: 50,
        vShiftPct: 50,
        source: "Synthetic test fixture",
        verified: true,
      },
    ],
  });
  return p;
}
const near = (a: number, b: number, epsilon = 1e-8) =>
  assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
test("legacy projects gain an empty library without invented product data", () => {
  const old = JSON.parse(JSON.stringify(blankProject()));
  delete old.projection;
  delete old.projectionLibrary;
  delete old.projectionDesigns;
  const p = stateSchema.parse({ version: 1, projects: [old], contacts: [] }).projects[0]!;
  assert.deepEqual(p.projectionLibrary, { projectors: [], lenses: [] });
  assert.equal(calculateProjection(p.projection, p.projectionLibrary).solution, null);
});
test("blend pixel budgets conserve single, double and quadruple coverage", () => {
  for (const cols of [1, 2, 4, 8])
    for (const rows of [1, 2, 4])
      for (const f of [0, 0.1, 0.2, 0.5]) {
        const b = pixelBudget(1920, 1200, cols, rows, cols > 1 ? f : 0, rows > 1 ? f : 0);
        near(
          b.totalProjectorPixels,
          b.singleCoveredPixels + 2 * b.doubleCoveredPixels + 4 * b.quadCoveredPixels,
          1e-6,
        );
        near(
          b.uniquePixels,
          b.singleCoveredPixels + b.doubleCoveredPixels + b.quadCoveredPixels,
          1e-6,
        );
        near(spanForTile(tileForSpan(20, cols, f), cols, f), 20);
      }
});
test("flat throw, zoom ranges and compensated luminance match independent calculations", () => {
  const p = fixture(),
    plan = calculateProjection(p.projection, p.projectionLibrary);
  assert.ok(plan.canApplyBom);
  assert.equal(plan.raster!.canvasWidth, 3456);
  assert.equal(plan.raster!.canvasHeight, 1200);
  near(plan.solution!.tileWidth, 8 / 1.8);
  near(plan.solution!.tileHeight, 8 / 1.8 / 1.6);
  near(plan.placements[0]!.requiredThrowRatio, 1.35);
  near(plan.placements[0]!.distanceMin!, (8 / 1.8) * 1.2);
  near(plan.luminanceNits!, 20000 / ((Math.PI * (8 / 1.8) ** 2) / 1.6));
  p.projectionLibrary.projectors[0]!.lumens = null;
  assert.equal(calculateProjection(p.projection, p.projectionLibrary).luminanceNits, null);
});
test("common-point arrays check both shift axes, unknown limits and compatible auto-selection", () => {
  const p = fixture();
  Object.assign(p.projection, { placement: "common-point", rows: 2, heightM: 5 });
  let plan = calculateProjection(p.projection, p.projectionLibrary);
  near(Math.abs(plan.placements[0]!.hShiftPct), 40);
  near(Math.abs(plan.placements[0]!.vShiftPct), 40);
  assert.ok(plan.diagnostics.some((d) => d.code === "coupled-shift"));
  p.projectionLibrary.lenses[0]!.vShiftPct = 30;
  plan = calculateProjection(p.projection, p.projectionLibrary);
  assert.equal(plan.canApplyBom, false);
  assert.ok(plan.diagnostics.some((d) => d.code === "vertical-shift"));
  p.projectionLibrary.lenses[0]!.vShiftPct = null;
  assert.ok(
    calculateProjection(p.projection, p.projectionLibrary).diagnostics.some(
      (d) => d.code === "unknown-shift",
    ),
  );
  p.projectionLibrary.lenses[0]!.vShiftPct = 50;
  p.projection.lensId = null;
  p.projectionLibrary.lenses.unshift({
    ...p.projectionLibrary.lenses[0]!,
    id: "wrong-shift",
    hShiftPct: 5,
  });
  assert.equal(calculateProjection(p.projection, p.projectionLibrary).lens!.id, "lens");
  p.projection.lensId = "wrong-shift";
  p.projectionLibrary.lenses[0]!.mount = "different";
  assert.equal(calculateProjection(p.projection, p.projectionLibrary).solution, null);
});
test("curved optics approach flat optics, allow the curvature centre and reject singular arcs", () => {
  near(curvedFlatImageWidth(1e9, 8, 4).flatWidth, 4, 1e-6);
  near(curvedFlatImageWidth(10, 10, 4).halfAngleRad, 0.2);
  const p = fixture();
  Object.assign(p.projection, {
    kind: "cylindrical",
    widthM: 12,
    heightM: 3,
    radiusM: 10,
    throwDistanceM: 10,
    columns: 3,
  });
  p.projectionLibrary.lenses[0]!.throwRatioMax = 3;
  const plan = calculateProjection(p.projection, p.projectionLibrary);
  assert.ok(plan.solution);
  assert.equal(plan.placements.length, 3);
  assert.ok(plan.solution!.curveHeightRatio < 1);
  assert.ok(!/NaN|Infinity/.test(projectionSvg(p.projection, plan, "plan")));
  p.projection.radiusM = 1;
  assert.equal(calculateProjection(p.projection, p.projectionLibrary).solution, null);
  Object.assign(p.projection, { widthM: 6, radiusM: 1, columns: 1, throwDistanceM: 0.5 });
  assert.equal(calculateProjection(p.projection, p.projectionLibrary).solution, null);
});
test("unsupported overlaps and uncovered screen regions block BOM and Arena export", () => {
  const p = fixture();
  Object.assign(p.projection, {
    columns: 1,
    rows: 1,
    fitMode: "fit-height",
    widthM: 8,
    heightM: 2,
  });
  const plan = calculateProjection(p.projection, p.projectionLibrary);
  assert.ok(plan.diagnostics.some((d) => d.code === "uncovered-screen"));
  assert.equal(plan.canApplyBom, false);
  assert.throws(() => projectionArenaXml(p), /Resolve/);
  Object.assign(p.projection, { columns: 2, rows: 2, fitMode: "fit-width", heightM: 20 });
  assert.equal(calculateProjection(p.projection, p.projectionLibrary).solution, null);
});
test("unverified profiles cannot apply BOMs and imported flags are never silently trusted", () => {
  const p = fixture();
  p.projectionLibrary.projectors[0]!.verified = false;
  assert.throws(() => applyProjectionBom(p), /verify/);
  const incoming = fixture().projectionLibrary,
    imported = importProjectionLibrary(p.projectionLibrary, incoming);
  assert.equal(imported.projectors.length, 2);
  assert.notEqual(imported.projectors[1]!.id, "body");
  assert.equal(imported.projectors[1]!.verified, false);
  assert.equal(imported.lenses[1]!.verified, false);
  assert.equal(incoming.projectors[0]!.verified, true);
});
test("BOM updates preserve model prices and drawing references, clear changed-model pricing and avoid included-lens double counting", () => {
  let p = applyProjectionBom(fixture());
  assert.equal(p.items.length, 2);
  p.items[0]!.unitCost = 1234;
  p.items[0]!.currency = "USD";
  p.items[0]!.fx = 1.4;
  p.items[0]!.ports = [{ id: "hdmi", label: "HDMI", direction: "input", connector: "HDMI" }];
  p.devices.push({
    id: "projector-on-drawing",
    itemId: p.items[0]!.id,
    label: "P1",
    x: 0,
    y: 0,
    rackStart: null,
  });
  p = applyProjectionBom(p);
  assert.equal(p.items.length, 2);
  assert.equal(p.items[0]!.unitCost, 1234);
  p.projectionLibrary.projectors[0]!.lensIncluded = true;
  p = applyProjectionBom(p);
  assert.equal(p.items.find((i) => i.id.endsWith("-lens"))!.scope, "Excluded");
  p.projectionLibrary.projectors[0]!.model = "DIFFERENT-MODEL";
  p = applyProjectionBom(p);
  assert.equal(p.items[0]!.unitCost, null);
  assert.equal(p.items[0]!.fx, 1);
  assert.equal(p.items[0]!.ports[0]!.id, "hdmi");
  assert.equal(p.devices[0]!.itemId, p.items[0]!.id);
  stateSchema.parse({ version: 1, projects: [p], contacts: [] });
});
test("saved designs isolate libraries, geometry and versioned BOMs", () => {
  let p = applyProjectionBom(fixture());
  p = saveProjectionDesign(p, "First layout");
  const first = structuredClone(p.projectionDesigns[0]!);
  p.projection.throwDistanceM = 6.5;
  p.name = "Changed working title";
  p = saveProjectionDesign(p, "Second layout");
  assert.equal(p.projectionDesigns[1]!.bomSnapshotId, first.bomSnapshotId);
  p.items[0]!.quantity = 9;
  p = saveProjectionDesign(p, "Changed BOM");
  assert.equal(p.projectionDesigns[2]!.bomRevision, 2);
  p.projectionLibrary.projectors[0]!.source = "Changed source";
  p.projectionLibrary.lenses[0]!.throwRatioMax = 2;
  assert.deepEqual(p.projectionDesigns[0], first);
  const restored = stateSchema.parse(
    JSON.parse(JSON.stringify({ version: 1, projects: [p], contacts: [] })),
  );
  assert.deepEqual(restored.projects[0]!.projectionDesigns[0], first);
});
test("Arena preset escapes names and uses bounded slices, virtual outputs and no invented blend controls", () => {
  const p = fixture();
  p.name = 'A<&" test';
  const xml = projectionArenaXml(p);
  assert.ok(xml.includes('<XmlState name="A&lt;&amp;&quot; test">'));
  assert.equal((xml.match(/<Screen name=/g) ?? []).length, 2);
  assert.equal((xml.match(/<OutputDeviceVirtual /g) ?? []).length, 2);
  assert.ok(xml.includes('width="3456" height="1200"'));
  assert.ok(!xml.includes("SoftEdgeLeft"));
  p.projection.hOverlap = 0.1735;
  p.projection.columns = 3;
  const plan = calculateProjection(p.projection, p.projectionLibrary);
  assert.equal(plan.raster!.canvasWidth, Math.max(...plan.raster!.slices.map((s) => s.input.x1)));
});
test("validation rejects missing references, unsupported profiles and oversized arrays; units round trip", () => {
  const p = fixture();
  p.projection.projectorId = "missing";
  assert.equal(stateSchema.safeParse({ version: 1, projects: [p], contacts: [] }).success, false);
  const lib = fixture().projectionLibrary;
  lib.lenses[0]!.source = "";
  assert.equal(projectionLibrarySchema.safeParse(lib).success, false);
  lib.lenses[0]!.verified = false;
  lib.lenses[0]!.throwRatioMax = 1;
  assert.equal(projectionLibrarySchema.safeParse(lib).success, false);
  assert.equal(projectionConfigSchema.safeParse({ columns: 32, rows: 32 }).success, false);
  assert.equal(projectionConfigSchema.safeParse({ widthM: 1e-200 }).success, false);
  near(toMetres(fromMetres(8, "imperial"), "imperial"), 8);
});
