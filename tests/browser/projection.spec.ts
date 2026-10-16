import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { blankProject, exampleState } from "../../src/features/workspace/model";
import {
  projectionConfigSchema,
  projectionLibrarySchema,
} from "../../src/features/workspace/projection-schema";

test("equipment profiles, BOM updates, saved reports, Arena geometry and library imports", async ({
  page,
}) => {
  const state = exampleState();
  state.projects[0]!.items[0]!.unitCost = 8181.23;
  state.projects.push(blankProject("Other projection project"));
  await page.addInitScript((state) => {
    if (!localStorage.getItem("soblabs-design-sandbox-v1"))
      localStorage.setItem("soblabs-design-sandbox-v1", JSON.stringify(state));
  }, state);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Projection planner", exact: true }).click();
  await page.getByRole("button", { name: "Add projector", exact: true }).click();
  const body = page.getByRole("dialog", { name: "Add projector profile", exact: true });
  await body.getByLabel("Manufacturer", { exact: true }).fill("Synthetic");
  await body.getByLabel("Projector model", { exact: true }).fill("Test WUXGA projector");
  await body.getByLabel("Lens mount family", { exact: true }).fill("Test family");
  await body.getByLabel("Native pixel width", { exact: true }).fill("1920");
  await body.getByLabel("Native pixel height", { exact: true }).fill("1200");
  await body.getByLabel("Rated light output (lumens)", { exact: true }).fill("20000");
  await body
    .getByLabel("Specification source / operating mode", { exact: true })
    .fill("Synthetic test fixture");
  await body.getByLabel("I checked these specifications against the source.").check();
  await body.getByRole("button", { name: "Save projector profile", exact: true }).click();
  await page.getByRole("button", { name: "Add lens", exact: true }).click();
  const lens = page.getByRole("dialog", { name: "Add lens profile", exact: true });
  await lens.getByLabel("Lens name / part number", { exact: true }).fill("Test zoom");
  await lens.getByLabel("Wide throw ratio", { exact: true }).fill("1.2");
  await lens.getByLabel("Tele throw ratio", { exact: true }).fill("1.8");
  await lens.getByLabel("Horizontal shift limit (% image width)", { exact: true }).fill("50");
  await lens.getByLabel("Vertical shift limit (% image height)", { exact: true }).fill("50");
  await lens
    .getByLabel("Specification source / operating mode", { exact: true })
    .fill("Synthetic lens fixture");
  await lens.getByLabel("I checked these specifications against the source.").check();
  await lens.getByRole("button", { name: "Save lens profile", exact: true }).click();
  await expect(page.locator("[data-projection-position]")).toHaveCount(2);
  const review = page.getByLabel(
    "I reviewed the projection specifications, coverage and BOM quantities.",
  );
  await review.check();
  await page.getByRole("button", { name: "Update projection BOM", exact: true }).click();
  await page.getByRole("button", { name: "Update projection BOM", exact: true }).click();
  await page.getByLabel("Projection design name", { exact: true }).fill("Projection R1");
  await page.getByRole("button", { name: "Save projection design", exact: true }).click();
  await page.getByRole("tab", { name: "Throw", exact: true }).click();
  await page.getByLabel("Nominal throw distance (m)", { exact: true }).fill("6.5");
  await expect(review).not.toBeChecked();
  await page.getByRole("button", { name: "Edit Test WUXGA projector", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit projector profile", exact: true });
  await edit.getByLabel("Projector model", { exact: true }).fill("Working model");
  await expect(
    edit.getByLabel("I checked these specifications against the source."),
  ).not.toBeChecked();
  await edit.getByRole("button", { name: "Save projector profile", exact: true }).click();
  await review.check();
  await expect(
    page.getByRole("button", { name: "Update projection BOM", exact: true }),
  ).toBeDisabled();
  const savedDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export saved projection PDF", exact: true }).click();
  await (await savedDownload).saveAs("/tmp/soblabs-projection-saved.pdf");
  const bytes = await readFile("/tmp/soblabs-projection-saved.pdf");
  const text = await page.evaluate(
    async (data) => {
      const path = "/src/features/workspace/files.ts";
      const { readPdf } = await import(/* @vite-ignore */ path);
      return readPdf(
        new File([new Uint8Array(data)], "projection.pdf", { type: "application/pdf" }),
      );
    },
    [...bytes],
  );
  expect(text).toContain("Projection R1");
  expect(text).toContain("Test WUXGA projector");
  expect(text).toContain("6.000 m");
  expect(text).not.toContain("Working model");
  expect(text).not.toContain("8181.23");
  const arenaDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Arena geometry preset", exact: true }).click();
  await (await arenaDownload).saveAs("/tmp/soblabs-projection-preset.xml");
  const xml = await readFile("/tmp/soblabs-projection-preset.xml", "utf8");
  const shapes = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return {
      errors: doc.querySelectorAll("parsererror").length,
      screens: doc.querySelectorAll("Screen").length,
      virtual: doc.querySelectorAll("OutputDeviceVirtual").length,
    };
  }, xml);
  expect(shapes).toEqual({ errors: 0, screens: 2, virtual: 2 });
  await page.getByRole("button", { name: "Open projection layout", exact: true }).click();
  await expect(page.getByLabel("Nominal throw distance (m)", { exact: true })).toHaveValue("6");
  const libraryDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export equipment library", exact: true }).click();
  await (await libraryDownload).saveAs("/tmp/soblabs-projection-library.json");
  await page
    .locator('input[type="file"][accept=".json"]')
    .setInputFiles("/tmp/soblabs-projection-library.json");
  await expect(
    page.getByRole("dialog", { name: "Review projection library import" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply library import", exact: true }).click();
  const imported = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("soblabs-design-sandbox-v1")!).projects[0].projectionLibrary,
  );
  expect(imported.projectors).toHaveLength(2);
  expect(imported.projectors[1].verified).toBe(false);
  await page.reload();
  await page.getByRole("button", { name: "Projection planner", exact: true }).click();
  await expect(page.getByText("Projection R1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Synthetic Test WUXGA projector", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Current project", exact: true })
    .selectOption({ label: "Other projection project" });
  await page.getByRole("button", { name: "Projection planner", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load illustrative example", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
]) {
  test.describe(`Projection desktop ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport, screen: viewport });
    test("curved array and plan view fit in the expanded drawing", async ({ page }) => {
      const state = exampleState(),
        p = state.projects[0]!;
      p.projection = projectionConfigSchema.parse({
        kind: "cylindrical",
        widthM: 20,
        heightM: 3,
        radiusM: 18,
        columns: 4,
        throwDistanceM: 15,
        projectorId: "test",
        lensId: "test-lens",
      });
      p.projectionLibrary = projectionLibrarySchema.parse({
        projectors: [
          {
            id: "test",
            model: "Synthetic WUXGA",
            nativeWidth: 1920,
            nativeHeight: 1200,
            mount: "test",
            lumens: 20000,
          },
        ],
        lenses: [
          {
            id: "test-lens",
            name: "Synthetic zoom",
            mount: "test",
            throwRatioMin: 1,
            throwRatioMax: 4,
          },
        ],
      });
      await page.addInitScript(
        (state) => localStorage.setItem("soblabs-design-sandbox-v1", JSON.stringify(state)),
        state,
      );
      await page.goto("/");
      await page.getByRole("button", { name: "Projection planner", exact: true }).click();
      await page.getByRole("button", { name: "Expand projection planner", exact: true }).click();
      const stage = page.getByRole("region", { name: "Projection drawing viewer", exact: true });
      await expect.poll(async () => (await stage.boundingBox())?.width).toBe(viewport.width);
      await expect.poll(async () => (await stage.boundingBox())?.height).toBe(viewport.height);
      await expect(stage.locator("[data-projection-position]")).toHaveCount(4);
      const canvas = await stage.locator(".ws-led-canvas").boundingBox();
      for (const position of [
        stage.locator("[data-projection-position]").first(),
        stage.locator("[data-projection-position]").last(),
      ]) {
        const box = await position.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(canvas!.x);
        expect(box!.y).toBeGreaterThanOrEqual(canvas!.y);
        expect(box!.x + box!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(canvas!.y + canvas!.height);
      }
      await stage.screenshot({
        path: `/workspace/artifacts/projection-elevation-${viewport.width}x${viewport.height}.png`,
      });
      await stage.getByRole("button", { name: "Plan view", exact: true }).click();
      await expect(stage.locator("[data-projection-column]")).toHaveCount(4);
      await stage.screenshot({
        path: `/workspace/artifacts/projection-plan-${viewport.width}x${viewport.height}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Expand projection planner", exact: true }),
      ).toBeVisible();
    });
  });
}
