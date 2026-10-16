import { test, expect } from "@playwright/test";
import { exampleState } from "../../src/features/workspace/model";

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
]) {
  test.describe(`AV desktop ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport, screen: viewport });
    test("full-window and fullscreen views fit a system at a readable overview scale", async ({
      page,
    }) => {
      const state = exampleState();
      const project = state.projects[0]!;
      project.items = [project.items[0]!];
      const item = project.items[0]!;
      item.description = "AV processor";
      item.manufacturer = "Soblabs";
      item.partNumber = "S-AV";
      item.quantity = 18;
      item.ports = Array.from({ length: 6 }, (_, n) => ({
        id: `port-${n}`,
        label: `Port ${n + 1}`,
        direction: n < 3 ? ("input" as const) : ("output" as const),
        connector: "HDMI",
      }));
      project.devices = Array.from({ length: 18 }, (_, n) => ({
        id: `device-${n}`,
        itemId: item.id,
        label: `DEVICE-${String(n + 1).padStart(2, "0")}`,
        x: (n % 6) * 340,
        y: Math.floor(n / 6) * 260,
        rackStart: null,
      }));
      project.connections = [];
      await page.addInitScript((initial) => {
        if (window === window.top)
          localStorage.setItem("soblabs-design-sandbox-v1", JSON.stringify(initial));
      }, state);
      await page.goto("/");
      await page.getByRole("button", { name: "System designer", exact: true }).click();
      const editor = page.frameLocator('iframe[title="Soblabs AV schematic canvas"]');
      await expect(
        page.getByText("AV edits linked to this project's BOM", { exact: true }),
      ).toBeVisible();
      await expect(editor.locator("app-device-node")).toHaveCount(18);
      await page.getByRole("button", { name: "Expand designer", exact: true }).click();
      const stage = page.locator(".ws-av-frame");
      await expect.poll(async () => (await stage.boundingBox())?.width).toBe(viewport.width);
      await expect.poll(async () => (await stage.boundingBox())?.height).toBe(viewport.height);
      await stage.getByRole("button", { name: "Full screen", exact: true }).click();
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
      await expect
        .poll(async () => (await stage.locator("iframe").boundingBox())?.height)
        .toBe(viewport.height - 44);
      await editor.getByRole("button", { name: "Fit all equipment", exact: true }).click();
      const checkFraming = async () => {
        const nodes = await editor.locator("app-device-node").evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
            };
          }),
        );
        const bounds = await editor.locator("ng-diagram").boundingBox();
        const libraryWidth = await editor
          .locator("app-library-sidebar")
          .evaluate((element) => element.getBoundingClientRect().right);
        const top = await editor
          .locator("app-top-navbar")
          .evaluate((element) => element.getBoundingClientRect().bottom);
        return nodes.every(
          (node) =>
            node.left >= libraryWidth &&
            node.right <= bounds!.width &&
            node.top >= top &&
            node.bottom <= bounds!.height &&
            node.width <= 205,
        );
      };
      await expect.poll(checkFraming).toBe(true);
      await expect(
        editor.getByRole("button", { name: "Zoom to 100%", exact: true }),
      ).not.toHaveText(/^[1-9][0-9]{2,}%$/);
      await editor.getByRole("button", { name: "Hide panels", exact: true }).click();
      await expect(
        editor.getByRole("button", { name: "Toggle library panel", exact: true }),
      ).toHaveAttribute("aria-expanded", "false");
      await editor.getByRole("button", { name: "Zoom to 100%", exact: true }).click();
      await expect(editor.getByRole("button", { name: "Zoom to 100%", exact: true })).toHaveText(
        "100%",
      );
      await editor.getByRole("button", { name: "Fit all equipment", exact: true }).click();
      await stage.screenshot({
        path: `/workspace/artifacts/av-desktop-${viewport.width}x${viewport.height}.png`,
      });
      await page.getByRole("button", { name: "Return to Factory", exact: true }).click();
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
      await expect(
        page.getByRole("button", { name: "Expand designer", exact: true }),
      ).toBeVisible();
      await expect(editor.locator("app-device-node")).toHaveCount(18);
    });
  });
}
