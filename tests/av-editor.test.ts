import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleState, stateSchema, removeItem, reconcile } from "../src/features/workspace/model";
import { projectToAv, applyAvDocument } from "../src/features/workspace/av-bridge";
import { captureDrawingSet, drawingProject } from "../src/features/workspace/drawing-sets";
import { drawingSvg } from "../src/features/workspace/drawing";

test("AV bridge exposes technical data and preserves BOM pricing, identities, rack positions and revisions", () => {
  const project = exampleState().projects[0]!;
  project.items[0]!.unitCost = 1234;
  const doc = projectToAv(project);
  assert.ok(!JSON.stringify(doc).includes("unitCost"));
  doc.nodes[0]!.data.deviceId = "PLAYER-101";
  doc.nodes[0]!.data.manufacturer = "BrightSign";
  doc.nodes[0]!.data.model = "XD235";
  doc.nodes[0]!.position.x += 200;
  doc.edges[0]!.data.lengthM = 15;
  doc.edges[0]!.points = [
    { x: 10, y: 20 },
    { x: 500, y: 20 },
  ];
  doc.edges[0]!.routingMode = "manual";
  const next = applyAvDocument(project, doc);
  assert.equal(next.items[0]!.unitCost, 1234);
  assert.equal(next.items[0]!.id, project.items[0]!.id);
  assert.equal(next.items[0]!.partNumber, "XD235");
  assert.equal(next.devices[0]!.rackStart, project.devices[0]!.rackStart);
  assert.equal(next.devices[0]!.label, "PLAYER-101");
  assert.equal(next.connections[0]!.lengthM, 15);
  const saved = captureDrawingSet(next, {
    title: "AV drawing",
    drawingNumber: "AV-001",
    bomName: "Main BOM",
    notes: "",
  });
  next.connections[0]!.route!.points[0]!.x = 999;
  assert.equal(saved.connections[0]!.route!.points[0]!.x, 10);
  assert.ok(
    drawingSvg(drawingProject(saved), "schematic", saved).includes('points="10,20 500,20"'),
  );
});

test("library drops create cost-unknown BOM equipment, reuse a template identity, and keep removed instances in the BOM", () => {
  const project = exampleState().projects[0]!;
  const doc = projectToAv(project);
  const node = structuredClone(doc.nodes[0]!);
  node.id = "new-device";
  delete node.data.factoryItemId;
  node.data.factoryTemplateId = "lib-test";
  node.data.model = "Test processor";
  const second = { ...structuredClone(node), id: "new-device-2" };
  doc.nodes.push(node, second);
  const next = applyAvDocument(project, doc);
  const item = next.items.find((i) => i.id === "av:lib-test")!;
  assert.equal(item.quantity, 2);
  assert.equal(item.unitCost, null);
  const reduced = projectToAv(next);
  reduced.nodes = reduced.nodes.filter((n) => !n.id.startsWith("new-device"));
  assert.ok(applyAvDocument(next, reduced).items.some((i) => i.id === item.id));
});

test("unfinished cables and custom templates survive backups, stay out of schedules and retain BOM metadata when reconnected", () => {
  const state = exampleState();
  const doc = projectToAv(state.projects[0]!);
  doc.edges[0]!.target = "";
  delete doc.edges[0]!.targetPort;
  doc.edges[0]!.targetPosition = { x: 700, y: 400 };
  doc.edges[0]!.data.lengthM = 12;
  doc.library = [{ libraryId: "custom", template: doc.nodes[0]!.data }];
  state.projects[0] = applyAvDocument(state.projects[0]!, doc);
  const restored = stateSchema.parse(JSON.parse(JSON.stringify(state))).projects[0]!;
  assert.equal(restored.connections.length, 0);
  assert.equal(restored.avDrafts.length, 1);
  assert.equal(restored.avLibrary?.[0]?.libraryId, "custom");
  assert.ok(reconcile(restored).some((s) => s.includes("unfinished")));
  const reconnected = projectToAv(restored);
  reconnected.edges[0]!.target = "d-processor";
  reconnected.edges[0]!.targetPort = "hdmi-in";
  const finished = applyAvDocument(restored, reconnected);
  assert.equal(finished.avDrafts.length, 0);
  assert.equal(finished.connections[0]!.lengthM, 12);
  assert.equal(removeItem(restored, "player").avDrafts.length, 0);
  restored.avDrafts[0]!.source = "missing-device";
  assert.equal(stateSchema.safeParse({ ...state, projects: [restored] }).success, false);
});

test("AV bridge refuses broken references, duplicate ports, changed identities and inconsistent shared specs", () => {
  const project = exampleState().projects[0]!;
  const check = (edit: (doc: ReturnType<typeof projectToAv>) => void) => {
    const doc = projectToAv(project);
    edit(doc);
    assert.throws(() => applyAvDocument(project, doc));
  };
  check((d) => {
    d.edges[0]!.sourcePort = "missing";
  });
  check((d) => {
    d.nodes[0]!.data.ports.push(d.nodes[0]!.data.ports[0]!);
  });
  check((d) => {
    d.nodes[0]!.data.factoryItemId = "processor";
  });
  check((d) => {
    const peer = structuredClone(d.nodes[0]!);
    peer.id = "peer";
    peer.data.model = "Conflicting model";
    d.nodes.push(peer);
  });
  check((d) => {
    d.edges[0]!.data.lengthM = -2;
  });
});
