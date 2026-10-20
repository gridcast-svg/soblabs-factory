import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("actual AV editor persists equipment edits, manual wire routes, library drops and CAD exports", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1800, height: 1200 });
  await page.goto("/");
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  const editor = page.frameLocator('iframe[title="Soblabs AV schematic canvas"]');
  await expect(editor.locator("app-device-node")).toHaveCount(2);
  await expect(
    page.getByText("AV edits linked to this project's BOM", { exact: true }),
  ).toBeVisible();
  await editor.locator("app-device-node").first().click();
  await editor.getByLabel("Device ID", { exact: true }).fill("PLAYER-101");
  await editor.getByLabel("Manufacturer", { exact: true }).fill("BrightSign");
  await editor.getByLabel("Model", { exact: true }).fill("XD235");
  await expect(page.getByLabel("Device label", { exact: true })).toHaveValue("PLAYER-101");
  await expect
    .poll(async () => {
      const saved = await page.evaluate(
        () => JSON.parse(localStorage.getItem("soblabs-design-sandbox-v1")!).projects[0],
      );
      return saved.items.find((item: { id: string }) => item.id === "player").manufacturer;
    })
    .toBe("BrightSign");
  await editor.getByRole("button", { name: "Outputs (1)", exact: true }).click();
  await editor.getByPlaceholder("Label", { exact: true }).fill("HDMI 1");
  await expect(page.getByLabel("Port label", { exact: true })).toHaveValue("HDMI 1");
  await editor.getByRole("button", { name: "Toggle properties panel", exact: true }).click();
  await editor.getByRole("button", { name: "Toggle library panel", exact: true }).click();
  await editor.locator(".wire-label").first().click();
  const handle = editor.locator(".reshape-overlay__handle").first();
  await expect(handle).toBeVisible();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 100, { steps: 12 });
  await page.mouse.up();
  const project = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("soblabs-design-sandbox-v1")!).projects[0]);
  await expect.poll(async () => (await project()).connections[0].route.mode).toBe("manual");
  await editor.getByLabel("Wire ID", { exact: true }).fill("V-101");
  await expect.poll(async () => (await project()).connections[0].label).toBe("V-101");
  expect((await project()).connections[0].cableType).toBe("HDMI");
  const routed = (await project()).connections[0].route.points;
  expect(routed.length).toBeGreaterThan(2);
  await editor.getByRole("button", { name: "Export", exact: true }).click();
  const pending = page.waitForEvent("download");
  await editor.getByRole("menuitem", { name: "Export to DXF", exact: true }).click();
  const dxf = await pending;
  const text = await readFile((await dxf.path())!, "utf8");
  expect(text).toContain("AC1027");
  expect(text).toContain("PLAYER-101");
  expect(text).toContain("V-101");
  await dxf.saveAs("/workspace/artifacts/soblabs-av-designer.dxf");
  await editor.getByRole("button", { name: "Toggle properties panel", exact: true }).click();
  await editor.getByRole("button", { name: "Toggle library panel", exact: true }).click();
  await editor.getByRole("textbox", { name: "Search devices" }).fill("HD224");
  await expect(editor.locator(".device-row")).toHaveCount(1);
  const template = editor.locator(".device-row").filter({ hasText: "HD224" }).first();
  await expect(template).toBeVisible();
  await editor
    .locator("ng-diagram-palette-item")
    .filter({ hasText: "HD224" })
    .locator(".draggable")
    .dragTo(editor.locator("ng-diagram"), { targetPosition: { x: 850, y: 550 } });
  await expect(editor.locator("app-device-node")).toHaveCount(3);
  await expect
    .poll(async () =>
      (await project()).items.some((item: { description: string }) => item.description === "HD224"),
    )
    .toBe(true);
  const state = await project();
  expect(
    state.items.find((item: { description: string }) => item.description === "HD224").unitCost,
  ).toBeNull();
  await editor.getByRole("button", { name: "Toggle library panel", exact: true }).click();
  const sourcePort = editor
    .locator("app-device-node")
    .filter({ hasText: "MEDIA-1" })
    .locator(".port-shape--output")
    .first();
  const targetPort = editor
    .locator("app-device-node")
    .filter({ hasText: "LED processor 01" })
    .locator(".port-shape--input")
    .first();
  await sourcePort.dragTo(targetPort);
  await expect.poll(async () => (await project()).connections.length).toBe(2);
  expect((await project()).connections[1].label).toBe("C-001");
  await page.reload();
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await expect(editor.locator("app-device-node")).toHaveCount(3);
  await expect(editor.locator(".wire-label").first()).toHaveText("V-101");
  expect((await project()).connections[0].route.mode).toBe("manual");
  await page
    .locator(".ws-av-frame")
    .screenshot({ path: "/workspace/artifacts/soblabs-av-designer.png" });
  expect(errors).toEqual([]);
});

test("Factory ignores schematic messages from an unrelated window", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await expect(
    page.getByText("AV edits linked to this project's BOM", { exact: true }),
  ).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem("soblabs-design-sandbox-v1"));
  await page.evaluate(() =>
    window.postMessage(
      { channel: "soblabs-av-v1", type: "change", document: { nodes: [], edges: [], library: [] } },
      location.origin,
    ),
  );
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("soblabs-design-sandbox-v1")))
    .toBe(before);
});

test("custom AV library templates persist per project without creating BOM items until placed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  const editor = page.frameLocator('iframe[title="Soblabs AV schematic canvas"]');
  await expect(
    page.getByText("AV edits linked to this project's BOM", { exact: true }),
  ).toBeVisible();
  await editor.getByRole("button", { name: "+ Add device", exact: true }).click();
  const detail = editor.locator("app-library-detail");
  await detail.getByLabel("Manufacturer", { exact: true }).fill("Soblabs");
  await detail.getByLabel("Model", { exact: true }).fill("LED receiver test");
  await detail.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = JSON.parse(localStorage.getItem("soblabs-design-sandbox-v1")!).projects[0];
        return project.avLibrary.some(
          (entry: { template: { model: string } }) => entry.template.model === "LED receiver test",
        );
      }),
    )
    .toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await editor.getByRole("textbox", { name: "Search devices" }).fill("LED receiver test");
  await expect(editor.locator(".device-row")).toHaveCount(1);
  await expect(editor.locator(".device-row")).toContainText("Soblabs");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("soblabs-design-sandbox-v1")!).projects[0].items.length,
    ),
  ).toBe(3);
});

test("AV theme preference survives reloads without changing project drawings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  const editor = page.frameLocator('iframe[title="Soblabs AV schematic canvas"]');
  await expect(editor.locator("app-device-node")).toHaveCount(2);
  const before = await page.evaluate(() => localStorage.getItem("soblabs-design-sandbox-v1"));
  await editor.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
  await expect(
    editor.getByRole("button", { name: "Switch to light theme", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await expect(editor.locator("app-device-node")).toHaveCount(2);
  await editor.getByRole("button", { name: "Switch to light theme", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await expect(
    editor.getByRole("button", { name: "Switch to dark theme", exact: true }),
  ).toBeVisible();
  await expect(editor.locator("app-device-node")).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem("soblabs-design-sandbox-v1"))).toBe(before);
});
