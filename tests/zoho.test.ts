import test from "node:test";
import assert from "node:assert/strict";
import { readZohoConfig, assertZohoOwner, fetchZohoSnapshot } from "../src/lib/zoho.server";
import { zohoPipelineTotals, zohoRecordUrl } from "../src/features/workspace/zoho-model";
import { stateSchema, exampleState } from "../src/features/workspace/model";
const config = readZohoConfig({
  ZOHO_REGION: "com",
  ZOHO_CRM_ORG_ID: "123456789",
  ZOHO_FACTORY_USER_ID: "12345678-1234-4234-8234-123456789abc",
  ZOHO_CLIENT_ID: "test-client",
  ZOHO_CLIENT_SECRET: "test-secret",
  ZOHO_REFRESH_TOKEN: "test-refresh",
  ZOHO_BASE_CURRENCY: "CAD",
  ZOHO_CLOSED_STAGES: "Closed Won|Closed Lost|Custom success",
})!;
const datasets = {
  Accounts: [{ id: "5849920000000123456", Account_Name: "Example company" }],
  Contacts: [
    {
      id: "2",
      First_Name: "Example",
      Last_Name: "Person",
      Account_Name: { name: "Example company" },
    },
  ],
  Deals: [
    {
      id: "3",
      Deal_Name: "CAD project",
      Stage: "Proposal",
      Amount: 100,
      Currency: "CAD",
      $stage: "open",
    },
    {
      id: "4",
      Deal_Name: "USD project",
      Stage: "Review",
      Amount: 200,
      Currency: "USD",
      $stage: "open",
    },
    {
      id: "5",
      Deal_Name: "Delivered",
      Stage: "Custom success",
      Amount: 900,
      Currency: "CAD",
      $stage: "closed_won",
    },
  ],
  Tasks: [{ id: "6", Subject: "Follow up", Status: "Not Started", Due_Date: "2026-10-20" }],
};
function mockRequest(overrides: (url: URL) => Response | undefined = () => undefined) {
  const requests: { url: URL; init?: RequestInit }[] = [];
  const request: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    const override = overrides(url);
    if (override) return override;
    if (url.pathname === "/oauth/v2/token")
      return Response.json({ access_token: "secret-access-token" });
    const module = url.pathname.split("/").at(-1) as keyof typeof datasets;
    return Response.json({ data: datasets[module], info: { more_records: false } });
  };
  return { request, requests };
}
test("Zoho config fails closed and only grants the designated Factory user", () => {
  assert.equal(readZohoConfig({}), null);
  assert.equal(readZohoConfig({ ZOHO_REGION: "attacker.test" }), null);
  assert.doesNotThrow(() => assertZohoOwner(config, config.userId));
  assert.throws(() => assertZohoOwner(config, "another-user"), /not connected/);
});
test("read-only snapshot preserves IDs, currency and custom closed stages without credentials", async () => {
  const { request, requests } = mockRequest();
  const snapshot = await fetchZohoSnapshot(config, request);
  assert.equal(snapshot.accounts[0]!.id, "5849920000000123456");
  assert.deepEqual(zohoPipelineTotals(snapshot), { CAD: 100, USD: 200 });
  assert.equal(snapshot.tasks[0]!.done, false);
  assert.ok(!JSON.stringify(snapshot).includes("secret"));
  assert.ok(requests.slice(1).every((r) => !r.init?.method || r.init.method === "GET"));
  assert.ok(requests.every((r) => r.init?.redirect === "error"));
  assert.equal(
    zohoRecordUrl(snapshot, "Accounts", snapshot.accounts[0]!.id),
    "https://crm.zoho.com/crm/org123456789/tab/Accounts/5849920000000123456",
  );
  assert.throws(() => zohoRecordUrl(snapshot, "Accounts", "javascript:alert(1)"));
  const state = exampleState();
  state.projects[0]!.zohoDealId = "3";
  const parsed = stateSchema.parse({ ...state, zohoSnapshot: snapshot });
  assert.equal(parsed.projects[0]!.zohoDealId, "3");
  assert.equal(stateSchema.parse(exampleState()).zohoSnapshot, undefined);
});
test("pagination reads later records and rejects incomplete snapshots", async () => {
  const { request } = mockRequest((url) =>
    url.pathname.endsWith("/Accounts")
      ? Response.json({
          data:
            url.searchParams.get("page") === "1"
              ? datasets.Accounts
              : [{ id: "7", Account_Name: "Second company" }],
          info: { more_records: url.searchParams.get("page") === "1" },
        })
      : undefined,
  );
  assert.equal((await fetchZohoSnapshot(config, request)).accounts.length, 2);
  const { request: capped } = mockRequest((url) =>
    url.pathname.endsWith("/Accounts")
      ? Response.json({ data: datasets.Accounts, info: { more_records: true } })
      : undefined,
  );
  await assert.rejects(fetchZohoSnapshot(config, capped), /2,000-record/);
});
test("authorization and API failures never expose provider secrets or return partial data", async () => {
  const { request } = mockRequest((url) =>
    url.pathname.endsWith("/Tasks")
      ? Response.json({ error: "private-details" }, { status: 403 })
      : undefined,
  );
  await assert.rejects(fetchZohoSnapshot(config, request), /Tasks could not be read \(HTTP 403\)/);
  const { request: failedAuth } = mockRequest((url) =>
    url.pathname === "/oauth/v2/token" ? Response.json({ error: "private-details" }) : undefined,
  );
  await assert.rejects(fetchZohoSnapshot(config, failedAuth), /authorization failed/);
  const { request: unsafeId } = mockRequest((url) =>
    url.pathname.endsWith("/Accounts")
      ? Response.json({
          data: [{ id: 5849920000000123456, Account_Name: "Unsafe ID" }],
          info: { more_records: false },
        })
      : undefined,
  );
  await assert.rejects(fetchZohoSnapshot(config, unsafeId), /could not be mapped/);
});
