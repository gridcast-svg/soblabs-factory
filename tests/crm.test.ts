import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleState, stateSchema, blankProject } from "../src/features/workspace/model.ts";
import { blankAccount, blankContact, blankActivity } from "../src/features/workspace/crm-model.ts";
import {
  parseDelimited,
  tableToAccountFile,
  guessMapping,
  previewAccountImport,
  applyAccountImport,
  readAccountFile,
} from "../src/features/workspace/crm-import.ts";
import {
  convertLead,
  safeWebsite,
  preserveAccountLinks,
} from "../src/features/workspace/crm-operations.ts";

test("old workspace migration preserves contact and project data while adding CRM collections", () => {
  const old = {
    version: 1,
    projects: [{ ...blankProject(), accountId: undefined }],
    contacts: [
      {
        id: "legacy",
        company: "Legacy Co",
        name: "Person",
        email: "",
        stage: "Proposal",
        notes: "Keep me",
      },
    ],
  };
  const current = stateSchema.parse(old);
  assert.deepEqual(current.accounts, []);
  assert.deepEqual(current.deals, []);
  assert.equal(current.contacts[0]!.notes, "Keep me");
  assert.equal(current.contacts[0]!.kind, "Contact");
  assert.equal(current.contacts[0]!.accountId, null);
  assert.equal(current.projects[0]!.name, old.projects[0]!.name);
});
test("CSV parser handles BOM, quoted commas, escaped quotes, multiline notes and long IDs", () => {
  const csv =
    '\uFEFFRecord ID,Account Name,Description\r\n5849920000000123456,"Example, Inc.","Line 1\nLine 2 with ""quote"""';
  const file = tableToAccountFile(parseDelimited(csv), "accounts.csv");
  const preview = previewAccountImport(file, guessMapping(file.headers), [], "fill");
  assert.equal(preview[0]!.account!.sourceId, "5849920000000123456");
  assert.equal(preview[0]!.account!.name, "Example, Inc.");
  assert.equal(preview[0]!.account!.notes, 'Line 1\nLine 2 with "quote"');
  assert.throws(() => parseDelimited('Name\n"unfinished'), /Unclosed/);
});
test("Zoho source IDs make repeated imports idempotent and sparse updates preserve existing values", () => {
  const first = tableToAccountFile(
    parseDelimited("Account ID,Account Name,Phone,Custom Field\n000123,Acme,555-0101,Original"),
    "a.csv",
  );
  const accounts = applyAccountImport(
    [],
    previewAccountImport(first, guessMapping(first.headers), [], "fill"),
  );
  assert.equal(accounts[0]!.sourceFields["Custom Field"], "Original");
  const later = tableToAccountFile(
    parseDelimited("Account ID,Account Name,Phone\n000123,New Name,"),
    "b.csv",
  );
  const p = previewAccountImport(later, guessMapping(later.headers), accounts, "update");
  assert.equal(p[0]!.action, "Update");
  const next = applyAccountImport(accounts, p);
  assert.equal(next.length, 1);
  assert.equal(next[0]!.id, accounts[0]!.id);
  assert.equal(next[0]!.phone, "555-0101");
  assert.equal(next[0]!.name, "New Name");
  const fill = previewAccountImport(later, guessMapping(later.headers), accounts, "fill");
  assert.equal(fill[0]!.account!.name, "Acme");
});
test("name-only matches need review, ambiguous matches and duplicate IDs block imports", () => {
  const a = blankAccount("Same Co");
  const file = tableToAccountFile(parseDelimited("Account Name\n same co "), "a.csv");
  assert.equal(
    previewAccountImport(file, guessMapping(file.headers), [a], "fill")[0]!.action,
    "Review",
  );
  assert.equal(
    previewAccountImport(file, guessMapping(file.headers), [a, blankAccount("Same Co")], "fill")[0]!
      .action,
    "Error",
  );
  const duplicates = tableToAccountFile(
    parseDelimited("Account ID,Account Name\n42,A\n42,B"),
    "duplicates.csv",
  );
  const preview = previewAccountImport(duplicates, guessMapping(duplicates.headers), [], "fill");
  assert.equal(preview[1]!.action, "Error");
  assert.throws(() => applyAccountImport([], preview), /Resolve/);
});
test("different Zoho IDs remain distinct even if company names match", () => {
  const existing = { ...blankAccount("Company"), source: "Zoho" as const, sourceId: "1" };
  const file = tableToAccountFile(parseDelimited("Account ID,Account Name\n2,Company"), "a.csv");
  const p = previewAccountImport(file, guessMapping(file.headers), [existing], "update");
  assert.equal(p[0]!.action, "Add");
  assert.equal(applyAccountImport([existing], p).length, 2);
});
test("JSON imports preserve API IDs and owners but reject unsafe numeric IDs", async () => {
  const data = {
    data: [
      {
        id: "5849920000000123456",
        Account_Name: "Example",
        Owner: { name: "Sales owner" },
        Custom: "Value",
      },
    ],
  };
  const file = new File([JSON.stringify(data)], "accounts.json");
  const parsed = await readAccountFile(file);
  const p = previewAccountImport(parsed, guessMapping(parsed.headers), [], "fill");
  assert.equal(p[0]!.account!.owner, "Sales owner");
  assert.equal(p[0]!.account!.sourceId, data.data[0]!.id);
  const bad = new File(['[{"id":5849920000000123456,"Account_Name":"X"}]'], "bad.json");
  await assert.rejects(() => readAccountFile(bad), /must be exported as strings/);
});
test("lead conversion retains person identity, notes and activities and creates one linked deal", () => {
  const state = exampleState();
  const lead = {
    ...blankContact("Lead"),
    company: "Example customer",
    name: "Person",
    notes: "Requirements",
  };
  state.contacts = [lead];
  state.activities = [{ ...blankActivity(), contactId: lead.id }];
  const next = convertLead(state, lead.id, null, true);
  assert.equal(next.contacts[0]!.id, lead.id);
  assert.equal(next.contacts[0]!.kind, "Contact");
  assert.equal(next.contacts[0]!.notes, "Requirements");
  assert.equal(next.deals[0]!.contactId, lead.id);
  assert.equal(next.activities[0]!.contactId, lead.id);
  assert.equal(next.accounts.length, 1);
  assert.ok(stateSchema.safeParse(next).success);
  assert.throws(() => convertLead(next, lead.id, null, true), /no longer/);
});
test("account renames update linked project/contact labels and dangling references are refused", () => {
  const state = exampleState();
  const a = blankAccount("Old name");
  state.accounts = [a];
  state.projects[0]!.accountId = a.id;
  state.contacts = [{ ...blankContact(), accountId: a.id, company: a.name }];
  const next = preserveAccountLinks(state, { ...a, name: "New name" });
  assert.equal(next.projects[0]!.customer, "New name");
  assert.equal(next.contacts[0]!.company, "New name");
  assert.ok(stateSchema.safeParse(next).success);
  next.activities = [{ ...blankActivity(), accountId: "missing" }];
  assert.equal(stateSchema.safeParse(next).success, false);
});
test("account website links refuse executable URLs", () => {
  assert.equal(safeWebsite("javascript:alert(1)"), null);
  assert.equal(safeWebsite("https://example.com"), "https://example.com/");
});
test("Excel account IDs remain text and unsafe numeric/formula-result IDs are rejected", async () => {
  const { default: ExcelJS } = await import("exceljs");
  async function workbook(id: unknown) {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Accounts");
    sheet.addRow(["Zoho Account ID", "Account name", "Phone"]);
    sheet.addRow([id, "Example company", "555-0101"]);
    const buffer = await wb.xlsx.writeBuffer();
    return new File([buffer as BlobPart], "accounts.xlsx");
  }
  const parsed = await readAccountFile(await workbook("0005849920000000123456"));
  const preview = previewAccountImport(parsed, guessMapping(parsed.headers), [], "fill");
  assert.equal(preview[0]!.account!.sourceId, "0005849920000000123456");
  await assert.rejects(
    () => workbook(Number("5849920000000123456")).then(readAccountFile),
    /stored as text/,
  );
  await assert.rejects(
    () => workbook({ formula: "1+1", result: Number("5849920000000123456") }).then(readAccountFile),
    /stored as text/,
  );
});
