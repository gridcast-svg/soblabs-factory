import { test } from "node:test";
import assert from "node:assert/strict";
import { blankProject, exampleState, stateSchema } from "../src/features/workspace/model.ts";
import { trackRecentWork } from "../src/features/workspace/recent-work.ts";
import { addDemoProjects, DEMO_PROJECT_IDS } from "../src/features/workspace/demo-data.ts";
import {
  blankAccount,
  blankContact,
  blankDeal,
  blankActivity,
} from "../src/features/workspace/crm-model.ts";
const at = "2026-10-20T12:00:00.000Z";

test("legacy backups gain an empty recent list, without invented edit dates", () => {
  const original = exampleState();
  const { recentWork: _, ...legacy } = original;
  assert.deepEqual(stateSchema.parse(legacy).recentWork, []);
  assert.deepEqual(trackRecentWork(original, structuredClone(original), at).recentWork, []);
});
test("recent work tracks changed sections, deduplicates, and ignores CRM-only changes", () => {
  const original = exampleState();
  const changed = structuredClone(original);
  changed.projects[0]!.items[0]!.description = "Edited player";
  changed.projects[0]!.led.width = 4000;
  const tracked = trackRecentWork(original, changed, at);
  assert.deepEqual(new Set(tracked.recentWork.map((e) => e.section)), new Set(["bom", "led"]));
  const editedAgain = structuredClone(tracked);
  editedAgain.projects[0]!.items[0]!.unitCost = 100;
  const next = trackRecentWork(tracked, editedAgain, "2026-10-20T13:00:00.000Z");
  assert.equal(next.recentWork[0]!.section, "bom");
  assert.equal(next.recentWork.length, 2);
  assert.equal(next.recentWork.find((e) => e.section === "led")!.editedAt, at);
  const crmOnly = { ...next, accounts: [blankAccount("CRM edit")] };
  assert.deepEqual(trackRecentWork(next, crmOnly, at).recentWork, next.recentWork);
});
test("deleted projects are removed from recents, and new projects are resumable", () => {
  const original = exampleState();
  const changed = { ...original, projects: [...original.projects, blankProject("New install")] };
  const tracked = trackRecentWork(original, changed, at);
  assert.equal(tracked.recentWork[0]!.projectId, changed.projects[1]!.id);
  const deleted = trackRecentWork(tracked, { ...tracked, projects: [original.projects[0]!] }, at);
  assert.deepEqual(deleted.recentWork, []);
});
test("demos add exactly three isolated projects with three entries per tool and preserve existing work/CRM", () => {
  const state = exampleState();
  state.accounts = [blankAccount("Existing real account")];
  state.contacts = [blankContact()];
  state.deals = [blankDeal()];
  state.activities = [blankActivity()];
  const snapshot = structuredClone(state);
  const demo = addDemoProjects(state, at);
  assert.deepEqual(state, snapshot);
  assert.equal(demo.projects.length, state.projects.length + 3);
  assert.deepEqual(demo.projects[0], state.projects[0]);
  for (const key of ["accounts", "contacts", "deals", "activities"] as const)
    assert.deepEqual(demo[key], state[key]);
  for (const id of DEMO_PROJECT_IDS) {
    const p = demo.projects.find((p) => p.id === id)!;
    for (const key of [
      "items",
      "drawingSets",
      "ledDesigns",
      "projectionDesigns",
      "meetings",
      "tasks",
    ] as const)
      assert.equal(p[key].length, 3, key);
    assert.equal(p.accountId, null);
    assert.ok(p.projectionLibrary.projectors.every((x) => !x.verified));
    assert.ok(p.projectionLibrary.lenses.every((x) => !x.verified));
    assert.ok(p.items.every((x) => x.unitCost === null));
    assert.ok(p.meetings.every((x) => x.text.includes("fictional")));
  }
  assert.deepEqual(addDemoProjects(demo, at), demo);
  assert.equal(stateSchema.safeParse(demo).success, true);
});
