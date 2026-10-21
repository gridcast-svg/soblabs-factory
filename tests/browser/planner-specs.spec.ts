import { test, expect } from "@playwright/test";

test("LED pitch presets drive pixel counts, exact edits release the target, and brightness/theme persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "LED configurator", exact: true }).click();
  await page.getByRole("combobox", { name: "Pixel pitch", exact: true }).selectOption("2.5");
  await expect(page.getByLabel("Cabinet pixel width", { exact: true })).toHaveValue("200");
  await expect(page.getByLabel("Cabinet pixel height", { exact: true })).toHaveValue("200");
  await expect(page.getByText("2400 × 1200", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Cabinet", exact: true }).click();
  await page.getByLabel("Rated brightness (nits)", { exact: true }).fill("1200");
  await page.getByLabel("Refresh rate (Hz)", { exact: true }).fill("3840");
  await page.getByRole("button", { name: "Switch to dark canvas", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "LED configurator", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Pixel pitch", exact: true })).toHaveValue("2.5");
  await expect(
    page.getByRole("button", { name: "Switch to light canvas", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1200 nits / 3840 Hz", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch to light canvas", exact: true }).click();
  await page.getByLabel("Cabinet pixel width", { exact: true }).fill("256");
  await expect(page.getByRole("combobox", { name: "Pixel pitch", exact: true })).toHaveValue(
    "exact",
  );
});

test("empty projection opens on Epson room preview without writing until adopted; sourced documents download", async ({
  page,
}) => {
  await page.goto("/");
  const before = await page.evaluate(() => localStorage.getItem("soblabs-design-sandbox-v1"));
  await page.getByRole("button", { name: "Projection planner", exact: true }).click();
  await expect(page.getByText(/Epson room example · 8 × 10 × 3 m/)).toBeVisible();
  await expect(page.locator("[data-projection-position]")).toHaveCount(1);
  await expect(page.getByText("3840 × 2160 px", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("soblabs-design-sandbox-v1"))).toBe(before);
  await page.getByRole("button", { name: "Use Epson room example", exact: true }).click();
  await page.getByRole("button", { name: "Plan view", exact: true }).click();
  await expect(page.locator("[data-room-boundary]")).toHaveCount(1);
  await page.getByRole("tab", { name: "Room", exact: true }).click();
  await expect(page.getByLabel("Room width (m)", { exact: true })).toHaveValue("8");
  await page.getByRole("tab", { name: "Equipment", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Projector profile", exact: true })).toHaveValue(
    "epson-EB-PQ2010W",
  );
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("soblabs-design-sandbox-v1")!),
  );
  expect(state.projects[0].projectionLibrary.projectors).toHaveLength(3);
  expect(state.projects[0].projectionLibrary.lenses).toHaveLength(9);
  for (const file of ["EB-PQ2010W-specification.pdf", "PQ-series-projectors-and-lenses.pdf"]) {
    const response = await page.request.get(`/specs/epson/${file}`);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
  }
  await page.reload();
  await page.getByRole("button", { name: "Projection planner", exact: true }).click();
  await expect(page.getByText(/Preview only; editing or saving/)).toHaveCount(0);
});
