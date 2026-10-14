import { test, expect } from "@playwright/test";
test("Zoho dashboard stays disconnected in the sandbox and preserves saved local records", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/zohoapis|oauth\/v2\/token|refreshZohoDashboard/.test(r.url())) requests.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "CRM", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zoho CRM dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh Zoho", exact: true })).toBeDisabled();
  await expect(page.getByText("Last updated: Never")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add deal", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Follow-ups", exact: true }).click();
  await expect(page.getByText("No Zoho snapshot yet.", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Previously saved Factory CRM records", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Add account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to Zoho dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zoho CRM dashboard" })).toBeVisible();
  expect(requests).toEqual([]);
});
