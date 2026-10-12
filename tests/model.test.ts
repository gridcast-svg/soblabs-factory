import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankItem,
  blankProject,
  exampleState,
  linePrice,
  totals,
  reconcile,
  removeItem,
  stateSchema,
} from "../src/features/workspace/model.ts";
import { mergeItems } from "../src/features/workspace/files.ts";
test("markup, CAD/USD conversion, alternatives and per-line tax", () => {
  const p = blankProject();
  p.taxRate = 13;
  const i = { ...blankItem(), unitCost: 100, markup: 25 };
  p.items = [
    i,
    { ...i, id: "usd", currency: "USD", fx: 1.35, quantity: 2 },
    { ...i, id: "alternative", scope: "Alternative", quantity: 100 },
  ] as typeof p.items;
  assert.deepEqual(linePrice(i, "CAD"), { cost: 100, sell: 125, profit: 25 });
  assert.deepEqual(totals(p), {
    cost: 370,
    sell: 462.5,
    tax: 60.13,
    profit: 92.5,
    total: 522.63,
    incomplete: 0,
  });
});
test("unknown cost and invalid same-currency exchange rates cannot become valid totals", () => {
  const p = blankProject();
  p.items = [blankItem(), { ...blankItem(), unitCost: 50, fx: 1.3 }];
  assert.equal(totals(p).incomplete, 2);
  assert.equal(totals(p).sell, 0);
});
test("reconciliation finds missing devices, unlinked cables and rack overlap", () => {
  const p = exampleState().projects[0]!;
  assert.ok(reconcile(p).some((x) => x.includes("72 in BOM")));
  assert.ok(reconcile(p).some((x) => x.includes("cable missing")));
  p.devices[0]!.rackStart = 1;
  assert.ok(reconcile(p).some((x) => x.includes("overlaps")));
});
test("deleting equipment removes devices and attached cables while keeping state valid", () => {
  const state = exampleState();
  state.projects[0] = removeItem(state.projects[0]!, "processor");
  assert.equal(state.projects[0]!.connections.length, 0);
  assert.equal(state.projects[0]!.devices.length, 1);
  assert.ok(stateSchema.safeParse(state).success);
});
test("backup validation rejects dangling connections and duplicate IDs", () => {
  const state = exampleState();
  state.projects[0]!.connections[0]!.target = "missing";
  assert.equal(stateSchema.safeParse(state).success, false);
  const valid = exampleState();
  valid.projects[0]!.items.push(valid.projects[0]!.items[0]!);
  assert.equal(stateSchema.safeParse(valid).success, false);
});
test("workbook revisions retain drawing specifications and omitted BOM items", () => {
  const a = blankItem(),
    b = blankItem();
  a.rackU = 2;
  a.ports = [{ id: "p", label: "IN", direction: "input", connector: "HDMI" }];
  const incoming = { ...a, quantity: 4, ports: [], rackU: 0 };
  const merged = mergeItems([a, b], [incoming]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]!.quantity, 4);
  assert.equal(merged[0]!.rackU, 2);
  assert.equal(merged[0]!.ports[0]!.connector, "HDMI");
});
