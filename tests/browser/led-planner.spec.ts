import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { blankProject, exampleState } from "../../src/features/workspace/model";

function sampleState() {
  const state = exampleState(),
    p = state.projects[0]!;
  p.led = { ...p.led, width: 2000, height: 1000, pixelWidth: 128, pixelHeight: 128 };
  Object.assign(p.ledPlanner, {
    cabinetManufacturer: "Synthetic",
    cabinetModel: "TEST-500",
    weightKg: 10,
    maxPowerW: 200,
    typicalPowerW: 80,
    pixelsPerPort: 65536,
    dataPorts: 4,
    processorPixels: 1000000,
    canvasWidth: 4096,
    canvasHeight: 4096,
    sourceDistanceM: 10,
    processorModel: "Synthetic sender",
  });
  p.items[0]!.unitCost = 2579.42;
  state.projects.push(blankProject("Second LED project"));
  return state;
}
test("LED routing, BOM updates, immutable saved reports and project isolation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((state) => {
    if (!localStorage.getItem("soblabs-design-sandbox-v1"))
      localStorage.setItem("soblabs-design-sandbox-v1", JSON.stringify(state));
  }, sampleState());
  await page.goto("/");
  await page.getByRole("button", { name: "LED configurator", exact: true }).click();
  await expect(page.locator(".ws-led-svg [data-cell]")).toHaveCount(8);
  await page.getByLabel("Route mode", { exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Clear layer", exact: true }).click();
  const checkbox = page.getByLabel("I have checked the specifications for this layout.");
  await checkbox.check();
  await expect(
    page.getByRole("button", { name: "Update project BOM", exact: true }),
  ).toBeDisabled();
  for (const [row, column] of [
    [2, 1],
    [1, 1],
    [1, 2],
    [2, 2],
  ])
    await page
      .getByRole("button", { name: `Cabinet row ${row} column ${column}`, exact: true })
      .click();
  await page.getByRole("button", { name: "New run", exact: true }).click();
  for (const [row, column] of [
    [2, 3],
    [1, 3],
    [1, 4],
    [2, 4],
  ])
    await page
      .getByRole("button", { name: `Cabinet row ${row} column ${column}`, exact: true })
      .click();
  await expect(page.getByText("Data: 0/8 cabinets routed.", { exact: true })).toHaveCount(0);
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.getByRole("button", { name: "Update project BOM", exact: true }).click();
  await page.getByRole("button", { name: "Update project BOM", exact: true }).click();
  await page.getByLabel("LED design name", { exact: true }).fill("Main wall R1");
  await page.getByRole("button", { name: "Save LED design", exact: true }).click();
  await expect(page.locator(".ws-led-saved-row")).toHaveCount(1);
  await page.getByLabel("Available width (mm)", { exact: true }).fill("1500");
  await expect(page.locator(".ws-led-svg [data-cell]")).toHaveCount(6);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export saved PDF", exact: true }).click();
  const pdf = await download;
  await pdf.saveAs("/tmp/soblabs-led-saved-report.pdf");
  const bytes = await readFile("/tmp/soblabs-led-saved-report.pdf");
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  const text = await page.evaluate(
    async (data) => {
      const path = "/src/features/workspace/files.ts";
      const { readPdf } = await import(/* @vite-ignore */ path);
      return readPdf(new File([new Uint8Array(data)], "report.pdf", { type: "application/pdf" }));
    },
    [...bytes],
  );
  expect(text).toContain("8 cabinets");
  expect(text).toContain("Main wall R1");
  expect(text).toContain("LED BOM snapshot");
  expect(text).not.toContain("2579.42");
  await page.reload();
  await page.getByRole("button", { name: "LED configurator", exact: true }).click();
  await expect(page.getByLabel("Available width (mm)", { exact: true })).toHaveValue("1500");
  await expect(page.locator(".ws-led-saved-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Open layout", exact: true }).click();
  await expect(page.locator(".ws-led-svg [data-cell]")).toHaveCount(8);
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Cable schedule CSV", exact: true }).click();
  expect((await csvDownload).suggestedFilename()).toBe("LED-cable-schedule.csv");
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "LED cabinets · configured display", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Current project", exact: true })
    .selectOption({ label: "Second LED project" });
  await page.getByRole("button", { name: "LED configurator", exact: true }).click();
  await expect(page.locator(".ws-led-saved-row")).toHaveCount(0);
  await page.getByRole("tab", { name: "Cabinet", exact: true }).click();
  await expect(page.getByLabel("Maximum cabinet power (W)", { exact: true })).toHaveValue("");
  await page.getByLabel("Maximum cabinet power (W)", { exact: true }).fill("2000");
  await page.getByLabel("I have checked the specifications for this layout.").check();
  await expect(
    page.getByRole("button", { name: "Update project BOM", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
]) {
  test.describe(`LED desktop ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport, screen: viewport });
    test("expanded routing fits the whole canvas", async ({ page }) => {
      const state = sampleState();
      state.projects[0]!.led.width = 6000;
      state.projects[0]!.led.height = 3000;
      await page.addInitScript(
        (state) => localStorage.setItem("soblabs-design-sandbox-v1", JSON.stringify(state)),
        state,
      );
      await page.goto("/");
      await page.getByRole("button", { name: "LED configurator", exact: true }).click();
      await page.getByRole("button", { name: "Expand LED planner", exact: true }).click();
      const stage = page.getByRole("region", { name: "LED routing editor", exact: true });
      await expect.poll(async () => (await stage.boundingBox())?.width).toBe(viewport.width);
      await expect.poll(async () => (await stage.boundingBox())?.height).toBe(viewport.height);
      await expect(stage.locator("[data-cell]")).toHaveCount(72);
      const canvas = await stage.locator(".ws-led-canvas").boundingBox();
      for (const cell of [
        stage.locator("[data-cell]").first(),
        stage.locator("[data-cell]").last(),
      ]) {
        const box = await cell.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(canvas!.x);
        expect(box!.y).toBeGreaterThanOrEqual(canvas!.y);
        expect(box!.x + box!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(canvas!.y + canvas!.height);
      }
      await stage.screenshot({
        path: `/workspace/artifacts/led-planner-${viewport.width}x${viewport.height}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Expand LED planner", exact: true }),
      ).toBeVisible();
    });
  });
}
