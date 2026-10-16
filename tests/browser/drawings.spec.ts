import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("saved drawing revisions retain BOM associations and export coordinated vector PDFs and cable labels", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await page.getByLabel("Drawing title", { exact: true }).fill("LED wall commissioning design");
  await page.getByLabel("Linked BOM name", { exact: true }).fill("East lobby BOM");
  await page
    .getByLabel("Revision notes", { exact: true })
    .fill("Initial cable and processor layout");
  await page.getByRole("button", { name: "Save drawing revision", exact: true }).click();
  const panel = page.getByRole("region", { name: "Drawing revisions and linked BOMs" });
  await expect(
    panel.getByText("LED wall commissioning design · R1", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText(/Linked BOM: East lobby BOM · R1/)).toBeVisible();
  await panel.getByText("Preview saved schematic", { exact: true }).click();
  await expect(page.getByAltText("Saved schematic SYS-001 revision 1")).toBeVisible();
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Cable schedule CSV", exact: true }).click();
  const csvFile = await csvDownload;
  const csv = await readFile((await csvFile.path())!, "utf8");
  expect(csv).toContain('"East lobby BOM"');
  expect(csv).toContain('"C-001"');
  expect(csv).toContain('"BOM snapshot ID"');
  expect(csv).not.toContain("unitCost");
  async function pdfText(button: string) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    const file = await pending;
    const bytes = [...(await readFile((await file.path())!))];
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    expect(Buffer.from(bytes).toString("latin1")).not.toContain("/Subtype /Image");
    await file.saveAs(
      `/workspace/artifacts/designer-${button === "Export PDF set" ? "drawing-set" : "cable-labels"}.pdf`,
    );
    const text = await page.evaluate(async (data) => {
      // @ts-expect-error Vite serves the browser module directly for export verification.
      const { readPdf } = await import("/src/features/workspace/files.ts");
      return readPdf(new File([new Uint8Array(data)], "export.pdf", { type: "application/pdf" }));
    }, bytes);
    return text as string;
  }
  const pdf = await pdfText("Export PDF set");
  expect(pdf).toContain("SYS-001");
  expect(pdf).toContain("East lobby BOM");
  expect(pdf).toContain("Cable schedule");
  expect(pdf).toContain("Device schedule");
  expect(pdf).toContain("Example media player");
  expect(pdf).toContain("BOM snapshot");
  const labels = await pdfText("Cable labels PDF");
  expect(labels).toContain("END A");
  expect(labels).toContain("END B");
  expect(labels.match(/C-001/g)?.length).toBe(2);
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Drawings linked to BOMs" }).getByText(/East lobby BOM R1/),
  ).toBeVisible();
  const firstItem = page.getByRole("button", { name: "Example media player", exact: true });
  await firstItem.click();
  const modal = page.locator(".ws-modal");
  await modal.getByLabel("Description", { exact: true }).fill("Changed working player");
  await modal.getByRole("button", { name: "Save component" }).click();
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await page.getByRole("button", { name: "Save drawing revision", exact: true }).click();
  await expect(panel.getByText(/Linked BOM: East lobby BOM · R2/)).toBeVisible();
  await page
    .getByRole("combobox", { name: "Saved drawing revision", exact: true })
    .selectOption({ label: "SYS-001 R1 — East lobby BOM R1" });
  const oldPdf = await pdfText("Export PDF set");
  expect(oldPdf).toContain("Example media player");
  expect(oldPdf).not.toContain("Changed working player");
  await page.reload();
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Saved drawing revision", exact: true }).locator("option"),
  ).toHaveCount(3);
  await page.screenshot({
    path: "/workspace/artifacts/soblabs-designer-revisions.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
