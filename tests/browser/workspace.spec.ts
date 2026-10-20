import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
const fixtureDir = "/tmp/soblabs-test-fixtures";
const legacyFile = process.env["SOBLABS_LEGACY_BOM"] || path.join(fixtureDir, "legacy-bom.xlsx");
const pdfFile = process.env["SOBLABS_PLAUD_PDF"] || path.join(fixtureDir, "meeting.pdf");
test.beforeAll(async () => {
  await mkdir(fixtureDir, { recursive: true });
  if (!process.env["SOBLABS_LEGACY_BOM"]) {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Cinema");
    sheet.getCell("D4").value = "QUANTITY";
    sheet.getCell("F4").value = "UNIT COST";
    sheet.getCell("D5").value = 2;
    sheet.getCell("E5").value = "Example display";
    sheet.getCell("F5").value = 100;
    sheet.getCell("H5").value = 0.25;
    await wb.xlsx.writeFile(legacyFile);
  }
  if (!process.env["SOBLABS_PLAUD_PDF"]) {
    const pdf = new jsPDF();
    pdf.text(
      [
        "System design meeting",
        "Action Items",
        "@Designer",
        "[ ] Confirm cabinet dimensions - [TBD]",
        "@Project lead",
        "[ ] Confirm installation access - [TBD]",
        "@Installer",
        "[ ] Check cable lengths - [TBD]",
      ],
      20,
      20,
    );
    pdf.save(pdfFile);
  }
});
test("project, BOM pricing and persistence", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("textbox", { name: "New project name" }).fill("Test installation");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const modal = page.locator(".ws-modal");
  await modal.getByLabel("Description", { exact: true }).fill("Rack computer");
  await modal.getByLabel("Unit cost", { exact: true }).fill("100");
  await modal.getByRole("button", { name: "Save component" }).click();
  await expect(page.getByText("$125.00").first()).toBeVisible();
  await page.reload();
  await page
    .getByRole("combobox", { name: "Current project" })
    .selectOption({ label: "Test installation" });
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rack computer", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("schematic and rack share device identity; export produces a drawing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="Soblabs AV schematic canvas"]').locator("app-device-node"),
  ).toHaveCount(2);
  await expect(page.getByText("C-001: cable missing from selected BOM")).toBeVisible();
  await page
    .frameLocator('iframe[title="Soblabs AV schematic canvas"]')
    .locator("app-device-node")
    .first()
    .click();
  await page.getByLabel("Rack starting U").fill("1");
  await expect(page.getByText(/Rack U1:.*overlaps/)).toBeVisible();
  await page.getByRole("button", { name: "Rack elevation" }).click();
  await expect(page.locator(".ws-rack-device")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  expect((await download).suggestedFilename()).toContain("rack.svg");
});
test("legacy Excel imports preview all rooms as alternatives before applying", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await page.locator('input[type=file][accept=".xlsx"]').setInputFiles(legacyFile);
  await expect(page.getByRole("heading", { name: "Review workbook import" })).toBeVisible();
  await expect(page.getByText(/Legacy rows are imported as alternatives/)).toBeVisible();
  await page.getByRole("button", { name: "Apply import" }).click();
  await expect(
    page
      .getByRole("button", {
        name: process.env["SOBLABS_LEGACY_BOM"] ? "Sony Bravia 65 - 3 Series" : "Example display",
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("Alternative", { exact: true }).first()).toBeVisible();
});
test("PLAUD PDF extraction proposes the three source action items without inventing deadlines", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Meeting notes", exact: true }).click();
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles(pdfFile);
  await expect(page.getByRole("heading", { name: "Review meeting import" })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole("textbox", { name: "Action title" })).toHaveCount(3);
  const actionOwner = page.getByRole("textbox", { name: "Action owner" }).nth(1);
  if (process.env["SOBLABS_PLAUD_PDF"]) await expect(actionOwner).not.toHaveValue("");
  else await expect(actionOwner).toHaveValue("Project lead");
  await expect(page.getByLabel("Action due date").first()).toHaveValue("");
  await page.getByRole("button", { name: "Save meeting and follow-ups" }).click();
  await expect(page.getByText(`Source: ${path.basename(pdfFile)}`)).toBeVisible();
});
test("LED cabinet update is idempotent and exports modern workbook", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "LED configurator", exact: true }).click();
  await page.getByLabel("I have checked the specifications for this layout.").check();
  await page.getByRole("button", { name: "Update project BOM" }).click();
  await page.getByRole("button", { name: "Update project BOM" }).click();
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "LED cabinets · configured display", exact: true }),
  ).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const file = await download;
  await file.saveAs("/tmp/soblabs-roundtrip.xlsx");
  await page
    .locator('input[type=file][accept=".xlsx"]')
    .setInputFiles("/tmp/soblabs-roundtrip.xlsx");
  await expect(page.getByRole("heading", { name: "Review workbook import" })).toBeVisible();
  await page.getByRole("button", { name: "Apply import" }).click();
  await expect(
    page.getByRole("button", { name: "LED cabinets · configured display", exact: true }),
  ).toHaveCount(1);
});
test("unconfigured account login cannot masquerade as authenticated access", async ({ page }) => {
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
  await expect(page.getByText(/Account backend is not configured/)).toBeVisible();
});

test("schematic cable mapping resolves the missing BOM cable and preserves endpoint labels", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await page.getByRole("button", { name: "C-001", exact: true }).click();
  await page.getByLabel("Specified length (m)").fill("10");
  await page.getByRole("button", { name: "Create BOM cable" }).click();
  await expect(page.getByText("C-001: cable missing from selected BOM")).toHaveCount(0);
  await expect(page.getByText("C-001: cable length requires site verification")).toHaveCount(0);
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await expect(page.getByRole("button", { name: "HDMI cable · 10m", exact: true })).toBeVisible();
});
test("rack drag-and-drop snaps equipment to rack units", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await page.getByRole("button", { name: "Rack elevation" }).click();
  await expect(page.getByTitle("Soblabs AV schematic canvas", { exact: true })).toHaveCount(0);
  await page
    .locator(".ws-rack-device")
    .filter({ hasText: "Media player" })
    .dragTo(page.locator(".ws-rack-slot").nth(35));
  await expect(page.getByLabel("Rack starting U")).toHaveValue("7");
  await expect(page.locator(".ws-rack-device")).toHaveCount(2);
});
