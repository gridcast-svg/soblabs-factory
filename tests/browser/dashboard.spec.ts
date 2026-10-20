import { test, expect } from "@playwright/test";
import { exampleState } from "../../src/features/workspace/model";
import { blankAccount } from "../../src/features/workspace/crm-model";

test("demo projects preserve existing records and CRM, show three examples per tool, and survive reload", async ({
  page,
}) => {
  const state = exampleState();
  state.accounts = [blankAccount("Existing customer")];
  await page.addInitScript((state) => {
    if (!localStorage.getItem("soblabs-design-sandbox-v1"))
      localStorage.setItem("soblabs-design-sandbox-v1", JSON.stringify(state));
  }, state);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Recent work", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add demo projects", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Demo projects added", exact: true }),
  ).toBeDisabled();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("soblabs-design-sandbox-v1")!),
  );
  expect(saved.projects).toHaveLength(4);
  expect(saved.projects[0]).toEqual(state.projects[0]);
  expect(saved.accounts).toEqual(state.accounts);
  for (const p of saved.projects.slice(1)) {
    for (const field of ["items", "drawingSets", "ledDesigns", "projectionDesigns", "meetings"])
      expect(p[field]).toHaveLength(3);
  }
  await page.getByRole("button", { name: "Bill of materials", exact: true }).click();
  await expect(page.locator(".ws-table tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: "System designer", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="Soblabs AV schematic canvas"]').locator("app-device-node"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("combobox", { name: "Saved drawing revision", exact: true }).locator("option"),
  ).toHaveCount(4);
  await page.getByRole("button", { name: "LED configurator", exact: true }).click();
  await expect(page.locator(".ws-led-saved-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Projection planner", exact: true }).click();
  await expect(page.locator(".ws-led-saved .ws-led-saved-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Meeting notes", exact: true }).click();
  await expect(page.locator(".ws-meeting-row")).toHaveCount(3);
  await page.getByRole("button", { name: "CRM", exact: true }).click();
  await expect(page.getByRole("button", { name: "Existing customer", exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Demo projects added", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Current project" }).locator("option"),
  ).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("recent edits reopen the correct project/tool and navigation does not alter timestamps", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open BOM", exact: true }).click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill("Client rack computer");
  await page.getByRole("button", { name: "Save component", exact: true }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.locator(".ws-recent-row").filter({ hasText: "Bill of materials" }),
  ).toBeVisible();
  const time = await page.locator(".ws-recent-row time").getAttribute("datetime");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("textbox", { name: "New project name" }).fill("Another client");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.locator(".ws-recent-row").filter({ hasText: "Bill of materials" }).click();
  await expect(page.getByRole("combobox", { name: "Current project" })).toHaveValue(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("soblabs-design-sandbox-v1")!).projects[0].id,
    ),
  );
  await expect(
    page.getByRole("button", { name: "Client rack computer", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".ws-recent-row").filter({ hasText: "Bill of materials" }).locator("time"),
  ).toHaveAttribute("datetime", time!);
});
