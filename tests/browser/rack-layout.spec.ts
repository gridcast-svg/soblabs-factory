import { test, expect } from "@playwright/test";
import { exampleState } from "../../src/features/workspace/model";

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
]) {
  test.describe(`Rack desktop ${viewport.width}`, () => {
    test.use({ viewport });
    test("all 42 units fit the panel, actual size scrolls, and expansion restores cleanly", async ({
      page,
    }) => {
      const state = exampleState();
      const project = state.projects[0]!;
      project.devices[0]!.rackStart = 40;
      project.devices[1]!.rackStart = 34;
      project.devices.push({
        ...project.devices[0]!,
        id: "extra-player",
        label: "Media player 02",
        rackStart: 31,
      });
      project.devices.push({
        id: "unplaced-display",
        itemId: "wall",
        label: "DISPLAY-1",
        x: 700,
        y: 300,
        rackStart: null,
      });
      await page.addInitScript((state) => {
        if (!localStorage.getItem("soblabs-design-sandbox-v1"))
          localStorage.setItem("soblabs-design-sandbox-v1", JSON.stringify(state));
      }, state);
      await page.goto("/");
      await page.getByRole("button", { name: "System designer", exact: true }).click();
      await page.getByRole("button", { name: "Rack elevation", exact: true }).click();
      const canvas = page.getByRole("region", { name: "Rack elevation canvas", exact: true });
      const editor = page.locator(".ws-rack-editor");
      const bounds = async () =>
        canvas.evaluate((el) => {
          const area = el.getBoundingClientRect();
          const first = el.querySelector('[data-rack-u="42"]')!.getBoundingClientRect();
          const last = el.querySelector('[data-rack-u="1"]')!.getBoundingClientRect();
          return first.top >= area.top && last.bottom <= area.bottom;
        });
      await expect.poll(bounds).toBe(true);
      const rackBounds = (await editor.boundingBox())!;
      const revisions = (await page
        .getByRole("region", { name: "Drawing revisions and linked BOMs" })
        .boundingBox())!;
      expect(revisions.y).toBeGreaterThan(rackBounds.y + rackBounds.height);
      await editor.scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "Actual size", exact: true }).click();
      await expect
        .poll(() =>
          page
            .locator('.ws-rack-slot[data-rack-u="1"]')
            .evaluate((el) => el.getBoundingClientRect().height),
        )
        .toBe(22);
      if (viewport.height === 1080) {
        expect(await canvas.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
        await canvas.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await expect(page.locator('.ws-rack-slot[data-rack-u="1"]')).toBeInViewport();
      }
      await page.getByRole("button", { name: "Fit rack", exact: true }).click();

      await page.getByRole("button", { name: "Expand rack designer", exact: true }).click();
      await expect.poll(async () => (await editor.boundingBox())?.height).toBe(viewport.height);
      await expect.poll(bounds).toBe(true);
      await page.screenshot({ path: `/workspace/artifacts/rack-boldcase-${viewport.width}.png` });
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Expand rack designer", exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  });
}

test("out-of-range rack devices remain selectable, and fitted drag placement clamps a 2U item at the top", async ({
  page,
}) => {
  const state = exampleState();
  state.projects[0]!.devices[1]!.rackStart = 42;
  await page.addInitScript((state) => {
    if (!localStorage.getItem("soblabs-design-sandbox-v1"))
      localStorage.setItem("soblabs-design-sandbox-v1", JSON.stringify(state));
  }, state);
  await page.goto("/");
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await page.getByRole("button", { name: "Rack elevation", exact: true }).click();
  const displaced = page
    .locator(".ws-rack-unplaced .ws-library-item")
    .filter({ hasText: "LED processor" });
  await expect(displaced).toContainText("Outside the 42U rack range");
  await displaced.click();
  await expect(page.getByLabel("Rack starting U", { exact: true })).toHaveValue("42");
  await displaced.dragTo(page.locator('[data-rack-u="42"]'));
  await expect(page.getByLabel("Rack starting U", { exact: true })).toHaveValue("41");
  await expect(page.locator(".ws-rack-device").filter({ hasText: "LED processor" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await page.getByRole("button", { name: "Rack elevation", exact: true }).click();
  await page.locator(".ws-rack-device").filter({ hasText: "LED processor" }).click();
  await expect(page.getByLabel("Rack starting U", { exact: true })).toHaveValue("41");
});
