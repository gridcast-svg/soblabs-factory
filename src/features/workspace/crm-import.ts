import { accountSchema, blankAccount } from "./crm-model";
import type { Account } from "./crm-model";
import { normalizeName } from "./crm-operations";
export const accountFields = [
  ["sourceId", "Zoho Account ID"],
  ["name", "Account name"],
  ["owner", "Account owner"],
  ["phone", "Phone"],
  ["website", "Website"],
  ["industry", "Industry"],
  ["type", "Account type"],
  ["billingStreet", "Billing street"],
  ["billingCity", "Billing city"],
  ["billingRegion", "Billing state / province"],
  ["billingPostalCode", "Billing postal code"],
  ["billingCountry", "Billing country"],
  ["notes", "Description / notes"],
  ["createdAt", "Created time"],
  ["updatedAt", "Modified time"],
] as const;
export type AccountField = (typeof accountFields)[number][0];
export type Mapping = Partial<Record<AccountField, string>>;
export type AccountFile = { headers: string[]; rows: Record<string, string>[]; name: string };
const normalizeHeader = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
const aliases: Record<AccountField, string[]> = {
  sourceId: ["Account ID", "Record ID", "id", "Zoho Account ID"],
  name: ["Account Name", "Company", "Company Name", "name"],
  owner: ["Account Owner", "Owner", "Owner Name"],
  phone: ["Phone", "Account Phone"],
  website: ["Website", "Web Site"],
  industry: ["Industry"],
  type: ["Account Type", "Type"],
  billingStreet: ["Billing Street", "Street"],
  billingCity: ["Billing City", "City"],
  billingRegion: ["Billing State", "Billing Province", "State", "Province", "Region"],
  billingPostalCode: ["Billing Code", "Billing ZIP", "Billing Postal Code", "Postal Code", "ZIP"],
  billingCountry: ["Billing Country", "Country"],
  notes: ["Description", "Notes"],
  createdAt: ["Created Time", "Created At"],
  updatedAt: ["Modified Time", "Updated At"],
};
export function guessMapping(headers: string[]): Mapping {
  const map: Mapping = {};
  for (const [field] of accountFields) {
    const h = headers.find((h) =>
      aliases[field].some((a) => normalizeHeader(a) === normalizeHeader(h)),
    );
    if (h) map[field] = h;
  }
  return map;
}
export function parseDelimited(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const scores = [",", ";", "\t"].map((delimiter) => {
    let quoted = false,
      count = 0;
    for (let i = 0; i < first.length; i++) {
      if (first[i] === '"') {
        if (quoted && first[i + 1] === '"') {
          i++;
          continue;
        }
        quoted = !quoted;
      } else if (!quoted && first[i] === delimiter) count++;
    }
    return { delimiter, count };
  });
  const delimiter = scores.sort((a, b) => b.count - a.count)[0]!.delimiter;
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let n = 0; n < text.length; n++) {
    const char = text[n]!;
    if (quoted) {
      if (char === '"') {
        if (text[n + 1] === '"') {
          cell += '"';
          n++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
      continue;
    }
    if (char === delimiter) {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[n + 1] === "\n") n++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else if (char === '"') {
      if (cell || closed)
        throw new Error("Unexpected quote in CSV. Export standard quoted CSV from Zoho.");
      quoted = true;
    } else if (closed) {
      if (!/\s/.test(char)) throw new Error("Unexpected text after closing CSV quote.");
    } else cell += char;
  }
  if (quoted) throw new Error("Unclosed quoted field in CSV.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export function tableToAccountFile(table: string[][], name: string): AccountFile {
  const headers = (table[0] ?? []).map((h) => h.trim());
  if (!headers.length || headers.some((h) => !h)) throw new Error("Every column needs a header.");
  if (new Set(headers.map(normalizeHeader)).size !== headers.length)
    throw new Error("Duplicate column headers. Rename them before importing.");
  const rows = table.slice(1).map((row, n) => {
    if (row.length > headers.length)
      throw new Error(`Row ${n + 2} has more fields than the header.`);
    return Object.fromEntries(headers.map((h, c) => [h, row[c] ?? ""]));
  });
  if (!rows.length) throw new Error("The file contains no account records.");
  if (rows.length > 5000) throw new Error("Import up to 5,000 accounts per file.");
  return { headers, rows, name };
}
function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const obj = v as {
      name?: unknown;
      text?: unknown;
      result?: unknown;
      richText?: { text: string }[];
    };
    if (obj.name !== undefined) return cellText(obj.name);
    if (obj.text !== undefined) return cellText(obj.text);
    if (obj.result !== undefined) return cellText(obj.result);
    if (obj.richText) return obj.richText.map((p) => p.text).join("");
    return JSON.stringify(v);
  }
  return String(v);
}
export async function readAccountFile(file: File): Promise<AccountFile> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Account imports must be smaller than 5 MB.");
  if (/\.csv$/i.test(file.name))
    return tableToAccountFile(parseDelimited(await file.text()), file.name);
  if (/\.json$/i.test(file.name)) {
    const parsed: unknown = JSON.parse(await file.text());
    const rows = Array.isArray(parsed) ? parsed : (parsed as { data?: unknown })?.data;
    if (!Array.isArray(rows) || !rows.length)
      throw new Error("JSON must contain an accounts array or a Zoho data array.");
    if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row)))
      throw new Error("Each JSON record must be an object.");
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return tableToAccountFile(
      [
        headers,
        ...rows.map((row) =>
          headers.map((h) => {
            const value = (row as Record<string, unknown>)[h];
            if (/id$/i.test(h) && typeof value === "number" && !Number.isSafeInteger(value))
              throw new Error("Large Zoho IDs must be exported as strings, not JSON numbers.");
            return cellText(value);
          }),
        ),
      ],
      file.name,
    );
  }
  if (/\.xlsx$/i.test(file.name)) {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const sheet = wb.getWorksheet("Accounts") ?? wb.worksheets[0];
    if (!sheet) throw new Error("Workbook has no worksheets.");
    if (sheet.rowCount > 5001) throw new Error("Import up to 5,000 accounts per file.");
    const table: string[][] = [];
    const header = sheet.getRow(1);
    let width = 0;
    header.eachCell((cell, col) => {
      if (cellText(cell.value).trim()) width = col;
    });
    sheet.eachRow((row) => {
      const values = Array.from({ length: width }, (_, n) => {
        const value = row.getCell(n + 1).value;
        const label = cellText(sheet.getRow(1).getCell(n + 1).value);
        const numericValue =
          value && typeof value === "object" && "result" in value ? value.result : value;
        if (
          /id$/i.test(label) &&
          typeof numericValue === "number" &&
          !Number.isSafeInteger(numericValue)
        )
          throw new Error("Zoho IDs must be stored as text in Excel.");
        return cellText(value);
      });
      if (values.some((v) => v.trim())) table.push(values);
    });
    return tableToAccountFile(table, file.name);
  }
  throw new Error("Choose a Zoho accounts CSV, XLSX, or JSON export.");
}
export type ImportRow = {
  row: number;
  action: "Add" | "Update" | "Review" | "Error";
  account: Account | null;
  matchId: string | null;
  message: string;
};
export function previewAccountImport(
  file: AccountFile,
  mapping: Mapping,
  existing: Account[],
  mode: "fill" | "update",
): ImportRow[] {
  if (!mapping.name)
    return [
      {
        row: 0,
        action: "Error",
        account: null,
        matchId: null,
        message: "Map the Account name column.",
      },
    ];
  const seen = new Set<string>();
  return file.rows.map((row, n) => {
    const value = (key: AccountField) => (row[mapping[key] ?? ""] ?? "").trim();
    const sourceId = value("sourceId");
    const name = value("name");
    const err = (message: string): ImportRow => ({
      row: n + 2,
      action: "Error",
      account: null,
      matchId: null,
      message,
    });
    if (!name) return err("Account name is missing.");
    const identity = sourceId ? "id:" + sourceId : "name:" + normalizeName(name);
    if (seen.has(identity)) return err("Duplicate account identity within this file.");
    seen.add(identity);
    const matches = sourceId
      ? existing.filter((a) => a.source === "Zoho" && a.sourceId === sourceId)
      : existing.filter((a) => normalizeName(a.name) === normalizeName(name));
    if (matches.length > 1)
      return err("Multiple existing accounts match. Supply a unique Zoho Account ID.");
    const old = matches[0];
    const account = { ...(old ?? blankAccount(name)) };
    for (const [key] of accountFields) {
      const incoming = value(key);
      if (incoming && (mode === "update" || !account[key])) account[key] = incoming;
    }
    account.name = mode === "fill" && old ? old.name : name;
    account.source = sourceId || !old ? "Zoho" : old.source;
    account.sourceId = sourceId || old?.sourceId || "";
    account.sourceFields = { ...old?.sourceFields, ...row };
    if (!account.createdAt) account.createdAt = new Date().toISOString();
    account.updatedAt = new Date().toISOString();
    const result = accountSchema.safeParse(account);
    if (!result.success) return err(result.error.issues[0]?.message || "Invalid record.");
    return {
      row: n + 2,
      action: old ? (sourceId ? "Update" : "Review") : "Add",
      account: result.data,
      matchId: old?.id ?? null,
      message: old
        ? sourceId
          ? "Matched exact Zoho ID"
          : "Matched company name only; confirm this is the same account"
        : sourceId && existing.some((a) => normalizeName(a.name) === normalizeName(name))
          ? "Same company name exists with a different identity; adding a separate account"
          : "New account",
    };
  });
}
export function applyAccountImport(existing: Account[], preview: ImportRow[]): Account[] {
  if (preview.some((p) => p.action === "Error") || !preview.length)
    throw new Error("Resolve import errors before applying.");
  const map = new Map(existing.map((a) => [a.id, a]));
  for (const p of preview) {
    if (!p.account) throw new Error("Invalid preview.");
    map.set(p.account.id, p.account);
  }
  return [...map.values()];
}
export async function exportAccounts(accounts: Account[]) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Accounts");
  sheet.addRow(accountFields.map(([, label]) => label));
  accounts.forEach((a) => sheet.addRow(accountFields.map(([key]) => a[key])));
  sheet.getColumn(1).numFmt = "@";
  sheet.columns.forEach((c) => (c.width = 24));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  const buffer = await wb.xlsx.writeBuffer();
  const { download } = await import("./files");
  download(
    "soblabs-accounts.xlsx",
    new Blob([buffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}
