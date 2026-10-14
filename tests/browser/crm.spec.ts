import { test, expect } from "@playwright/test";
import { blankProject } from "../../src/features/workspace/model";
async function openCrm(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "CRM", exact: true }).click();
  await page
    .getByRole("button", { name: "Previously saved Factory CRM records", exact: true })
    .click();
}
test("Zoho account import is previewed, preserves long IDs, and deduplicates repeated imports", async ({
  page,
}) => {
  await openCrm(page);
  const csv =
    "Account ID,Account Name,Account Owner,Phone,Industry,Description\n5849920000000123456,Example Systems,Sales owner,555-0101,AV,Project requirements";
  const upload = { name: "zoho-accounts.csv", mimeType: "text/csv", buffer: Buffer.from(csv) };
  await page.locator('input[type=file][accept=".csv,.xlsx,.json"]').setInputFiles(upload);
  await expect(page.getByRole("heading", { name: "Review Zoho account import" })).toBeVisible();
  await expect(page.getByText("Add: 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply account import" }).click();
  await expect(page.getByRole("button", { name: "Example Systems", exact: true })).toHaveCount(1);
  await expect(page.getByText("5849920000000123456", { exact: true })).toBeVisible();
  await page.locator('input[type=file][accept=".csv,.xlsx,.json"]').setInputFiles(upload);
  await expect(page.getByText("Update: 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply account import" }).click();
  await expect(page.getByRole("button", { name: "Example Systems", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Example Systems", exact: true }).click();
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("555-0101");
  await page.getByLabel("Account name", { exact: true }).fill("Renamed Systems");
  await page.getByRole("button", { name: "Save account", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "CRM", exact: true }).click();
  await page
    .getByRole("button", { name: "Previously saved Factory CRM records", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Renamed Systems", exact: true })).toBeVisible();
});
test("lead conversion creates account/contact/deal and a won deal creates a linked project", async ({
  page,
}) => {
  await openCrm(page);
  await page.getByRole("tab", { name: /Leads/ }).click();
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  const modal = page.locator(".crm-record-modal");
  await modal.getByLabel("Name", { exact: true }).fill("Example Person");
  await modal.getByLabel("Company", { exact: true }).fill("Example Customer");
  await modal.getByRole("button", { name: "Save lead", exact: true }).click();
  await page.getByRole("button", { name: "Convert lead", exact: true }).click();
  await page.getByRole("button", { name: "Confirm conversion", exact: true }).click();
  await expect(page.getByRole("button", { name: "Example Person", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: /Contacts/ }).click();
  await expect(page.getByRole("button", { name: "Example Person", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Deals/ }).click();
  await page.getByRole("button", { name: /Example Customer opportunity/ }).click();
  await modal.getByLabel("Deal value").fill("10000");
  await modal.getByRole("combobox", { name: "Stage", exact: true }).selectOption("Won");
  await modal.getByRole("button", { name: "Save deal", exact: true }).click();
  await page.getByRole("button", { name: /Example Customer opportunity/ }).click();
  await modal.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(modal.getByLabel("Linked project")).not.toHaveValue("");
  await modal.getByRole("button", { name: "Save deal", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Current project" })).toHaveValue(/.+/);
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.getByLabel("CRM account")).not.toHaveValue("");
  await expect(page.getByLabel("Customer / Company")).toHaveValue("Example Customer");
});
test("account activity can be completed and filtered without losing its links", async ({
  page,
}) => {
  await openCrm(page);
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  const modal = page.locator(".crm-record-modal");
  await modal.getByLabel("Account name", { exact: true }).fill("Followup Company");
  await modal.getByRole("button", { name: "Save account" }).click();
  await page.getByRole("button", { name: "Add activity for Followup Company" }).click();
  await modal.getByLabel("Subject", { exact: true }).fill("Confirm installation date");
  await modal.getByLabel("Activity owner", { exact: true }).fill("Owner");
  await modal.getByLabel("Due date", { exact: true }).fill("2026-12-01");
  await modal.getByRole("button", { name: "Save activity" }).click();
  await page.getByRole("tab", { name: /Activities/ }).click();
  await expect(page.getByText("Followup Company", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Complete Confirm installation date" }).check();
  await page.getByRole("combobox", { name: "Filter CRM status" }).selectOption("Open");
  await expect(
    page.getByRole("button", { name: "Confirm installation date", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("combobox", { name: "Filter CRM status" }).selectOption("Completed");
  await expect(
    page.getByRole("button", { name: "Confirm installation date", exact: true }),
  ).toBeVisible();
});
test("legacy browser workspace is upgraded without erasing contacts or project notes", async ({
  page,
}) => {
  const project = { ...blankProject("Existing project"), customer: "Old company" };
  const legacy = {
    version: 1,
    projects: [project],
    contacts: [
      {
        id: "old-contact",
        name: "Existing person",
        company: "Old company",
        email: "person@example.com",
        stage: "Proposal",
        notes: "Existing notes",
      },
    ],
  };
  await page.addInitScript(
    (value) => localStorage.setItem("soblabs-design-sandbox-v1", JSON.stringify(value)),
    legacy,
  );
  await openCrm(page);
  await page.getByRole("tab", { name: /Contacts/ }).click();
  await page.getByRole("button", { name: "Existing person", exact: true }).click();
  await expect(page.locator(".crm-record-modal").getByLabel("Notes")).toHaveValue("Existing notes");
  await expect(page.getByRole("combobox", { name: "Current project" })).toHaveValue(project.id);
});
