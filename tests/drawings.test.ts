import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exampleState,
  stateSchema,
  removeItem,
  reconcile,
} from "../src/features/workspace/model.ts";
import {
  captureDrawingSet,
  drawingProject,
  cableCsv,
  cableSchedule,
  nextCableLabel,
} from "../src/features/workspace/drawing-sets.ts";
import { drawingSvg } from "../src/features/workspace/drawing.ts";
const input = {
  title: "System design",
  drawingNumber: "SYS-001",
  bomName: "Installation BOM",
  notes: "First revision",
};

test("old backups gain empty drawing histories without changing their design", () => {
  const state = exampleState();
  const old = JSON.parse(JSON.stringify(state));
  delete old.projects[0].drawingSets;
  const parsed = stateSchema.parse(old);
  assert.deepEqual(parsed.projects[0]!.drawingSets, []);
  assert.deepEqual(parsed.projects[0]!.devices, state.projects[0]!.devices);
});

test("saved drawing and BOM snapshots survive working edits, removal and JSON round trips", () => {
  const state = exampleState();
  const p = state.projects[0]!;
  p.currency = "USD";
  p.taxRate = 13;
  const drawing = captureDrawingSet(p, input);
  p.drawingSets.push(drawing);
  const oldLabel = drawing.devices[0]!.label;
  const oldQuantity = drawing.items[0]!.quantity;
  p.items[0]!.quantity += 7;
  p.devices[0]!.label = "Changed working label";
  state.projects[0] = removeItem(p, p.items[0]!.id);
  const restored = stateSchema.parse(JSON.parse(JSON.stringify(state))).projects[0]!
    .drawingSets[0]!;
  assert.equal(restored.items[0]!.quantity, oldQuantity);
  assert.equal(restored.devices[0]!.label, oldLabel);
  assert.equal(restored.bomSnapshotId, drawing.bomSnapshotId);
  assert.equal(drawingProject(restored).currency, "USD");
  assert.equal(drawingProject(restored).taxRate, 13);
  assert.ok(drawingSvg(drawingProject(restored), "schematic", restored).includes(oldLabel));
});

test("layout-only drawings reuse a BOM snapshot; changed BOMs receive a new revision", () => {
  const p = exampleState().projects[0]!;
  const first = captureDrawingSet(p, input);
  p.drawingSets.push(first);
  p.devices[0]!.x += 120;
  const second = captureDrawingSet(p, input);
  assert.equal(second.drawingRevision, 2);
  assert.equal(second.bomSnapshotId, first.bomSnapshotId);
  assert.equal(second.bomRevision, 1);
  p.drawingSets.push(second);
  p.items[0]!.quantity += 1;
  const third = captureDrawingSet(p, input);
  assert.equal(third.drawingRevision, 3);
  assert.equal(third.bomRevision, 2);
  assert.notEqual(third.bomSnapshotId, first.bomSnapshotId);
  const other = captureDrawingSet(p, { ...input, bomName: "Alternate room BOM" });
  assert.equal(other.bomName, "Alternate room BOM");
  assert.notEqual(other.bomSnapshotId, third.bomSnapshotId);
});

test("backups reject broken saved references, duplicate revisions, wrong projects and conflicting BOMs", () => {
  const state = exampleState();
  const p = state.projects[0]!;
  p.drawingSets.push(captureDrawingSet(p, input));
  const drawing = p.drawingSets[0]!;
  const check = (change: (copy: typeof state) => void) => {
    const copy = structuredClone(state);
    change(copy);
    assert.equal(stateSchema.safeParse(copy).success, false);
  };
  check((s) => {
    s.projects[0]!.drawingSets[0]!.devices[0]!.itemId = "missing";
  });
  check((s) => {
    s.projects[0]!.drawingSets[0]!.connections[0]!.sourcePort = "missing";
  });
  check((s) => {
    s.projects[0]!.drawingSets[0]!.sourceProjectId = "another-project";
  });
  check((s) => {
    s.projects[0]!.drawingSets.push({ ...structuredClone(drawing), id: "another-id" });
  });
  check((s) => {
    const second = { ...structuredClone(drawing), id: "another-id", drawingRevision: 2 };
    second.items[0]!.quantity += 2;
    s.projects[0]!.drawingSets.push(second);
  });
});

test("SVG escaping, tall port lists, cable schedule identity and CSV formula protection", () => {
  const p = exampleState().projects[0]!;
  p.devices[0]!.label = '<script>alert("x")</script>';
  p.connections[0]!.label = '=HYPERLINK("bad")';
  p.items[0]!.ports.push(
    ...Array.from({ length: 30 }, (_, n) => ({
      id: `extra-${n}`,
      label: `Port ${n}`,
      direction: "input" as const,
      connector: "RJ45",
    })),
  );
  const drawing = captureDrawingSet(p, input);
  const svg = drawingSvg(drawingProject(drawing), "schematic", drawing);
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(svg.includes("Port 29"));
  assert.ok(Number(svg.match(/height="([0-9.]+)"/)![1]) > 1000);
  assert.equal(cableSchedule(drawing)[0]!.id, drawing.connections[0]!.label);
  const csv = cableCsv(drawing);
  assert.ok(csv.includes(drawing.bomSnapshotId));
  assert.ok(csv.includes("'="));
  assert.ok(!csv.includes("unitCost"));
});

test("cable numbering avoids duplicates after deletion and duplicate edited IDs are flagged", () => {
  const p = exampleState().projects[0]!;
  const first = p.connections[0]!;
  p.connections = [
    { ...first, label: "C-001" },
    { ...first, id: "another", label: "C-003" },
  ];
  assert.equal(nextCableLabel(p.connections), "C-002");
  p.connections[1]!.label = "c-001";
  assert.ok(reconcile(p).some((issue) => issue.includes("duplicate cable ID")));
});
