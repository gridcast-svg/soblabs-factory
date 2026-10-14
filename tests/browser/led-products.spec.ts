import { test, expect } from "@playwright/test";
import { jsPDF } from "jspdf";
async function openLed(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "LED configurator", exact: true }).click();
}
test("PDF upload is reviewed, persists a product, and creates one correctly sized BOM line", async ({
  page,
}) => {
  await openLed(page);
  const pdf = new jsPDF();
  pdf.text(
    [
      "Example cabinet datasheet",
      "Cabinet dimensions: 500 x 500 x 40 mm",
      "Cabinet resolution: 256 x 256 pixels",
      "Pixel pitch: 1.95 mm",
      "Brightness: 800 nits",
    ],
    20,
    20,
  );
  await page
    .locator('input[accept=".pdf,.csv,.xlsx,.json"]')
    .setInputFiles({
      name: "example-datasheet.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdf.output("arraybuffer")),
    });
  const dialog = page.getByRole("dialog", { name: "Review LED specifications" });
  await expect(dialog.getByLabel("Cabinet width (mm)", { exact: false })).toHaveValue("500");
  await expect(dialog.getByLabel("Cabinet pixels wide", { exact: false })).toHaveValue("256");
  await expect(dialog.getByRole("button", { name: "Save product specifications" })).toBeDisabled();
  await dialog.getByLabel("Manufacturer", { exact: false }).fill("Example manufacturer");
  await dialog.getByLabel("Model", { exact: false }).fill("Sample P1.95");
  await dialog.getByLabel("Series", { exact: true }).fill("Sample series");
  await dialog.getByLabel("I reviewed this product against its specification source.").check();
  await dialog.getByRole("button", { name: "Save product specifications" }).click();
  await page.getByRole("button", { name: "Browse products", exact: true }).click();
  await page.getByRole("textbox", { name: "Search LED products" }).fill("P1.95");
  await expect(page.getByText("Sample P1.95", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Select product", exact: true }).click();
  await page.getByLabel("I have checked the specifications for this layout.").check();
  await page.getByRole("button", { name: "Update project BOM", exact: true }).click();
  await page.getByRole("button", { name: "Update project BOM", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "LED configurator", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Project specification" })).toBeVisible();
  await expect(page.getByText("example-datasheet.pdf", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Example manufacturer Sample P1.95 · configured display",
      exact: true,
    }),
  ).toHaveCount(1);
});
test("product browsing supports grouping, filters, list view, units and empty states", async ({
  page,
}) => {
  await openLed(page);
  await page.getByRole("combobox", { name: "LED dimension units" }).selectOption("m");
  await page.getByLabel("Display width", { exact: true }).fill("3");
  await page.getByLabel("Display height", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Browse products", exact: true }).click();
  await expect(page.getByText("3.00 × 2.00 m", { exact: false }).first()).toBeVisible();
  await page.getByLabel("Filter LED environment").selectOption("Outdoor");
  await expect(page.getByText("No products match.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("button", { name: "Product list view", exact: true }).click();
  await expect(page.locator(".led-list-view")).toBeVisible();
  await page.getByLabel("Resolution", { exact: true }).check();
  await expect(page.getByText("1500 × 1000 pixels", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select product", exact: true }).click();
  await expect(page.getByText("6 × 4 = 24", { exact: true })).toBeVisible();
});
