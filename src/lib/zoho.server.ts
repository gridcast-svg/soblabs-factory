import { z } from "zod";
import { zohoId, zohoRegions, zohoSnapshotSchema } from "@/features/workspace/zoho-model";
const configSchema = z.object({
  region: z.enum(zohoRegions),
  orgId: zohoId,
  userId: z.string().uuid(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  closedStages: z.array(z.string().min(1)).min(1),
});
export type ZohoConfig = z.infer<typeof configSchema>;
export function readZohoConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = configSchema.safeParse({
    region: env["ZOHO_REGION"],
    orgId: env["ZOHO_CRM_ORG_ID"],
    userId: env["ZOHO_FACTORY_USER_ID"],
    clientId: env["ZOHO_CLIENT_ID"],
    clientSecret: env["ZOHO_CLIENT_SECRET"],
    refreshToken: env["ZOHO_REFRESH_TOKEN"],
    currency: env["ZOHO_BASE_CURRENCY"],
    closedStages: env["ZOHO_CLOSED_STAGES"]
      ?.split("|")
      .map((s) => s.trim())
      .filter(Boolean),
  });
  return parsed.success ? parsed.data : null;
}
export function assertZohoOwner(config: ZohoConfig, userId: string) {
  if (config.userId !== userId) throw new Error("This Factory account is not connected to Zoho.");
}
const nullableText = z.string().nullish();
const lookup = z.object({ name: nullableText }).nullish();
const base = { id: zohoId, Owner: lookup };
const account = z.object({
  ...base,
  Account_Name: z.string(),
  Phone: nullableText,
  Website: nullableText,
});
const contact = z.object({
  ...base,
  First_Name: nullableText,
  Last_Name: z.string(),
  Email: nullableText,
  Phone: nullableText,
  Account_Name: lookup,
});
const deal = z.object({
  ...base,
  Deal_Name: z.string(),
  Account_Name: lookup,
  Stage: z.string(),
  Amount: z.number().finite().nonnegative().nullish(),
  Currency: nullableText,
  Closing_Date: nullableText,
});
const task = z.object({
  ...base,
  Subject: z.string(),
  Due_Date: nullableText,
  Status: z.string(),
  What_Id: lookup,
});
const fields = {
  Accounts: "Account_Name,Phone,Website,Owner",
  Contacts: "First_Name,Last_Name,Email,Phone,Account_Name,Owner",
  Deals: "Deal_Name,Account_Name,Stage,Amount,Currency,Closing_Date,Owner",
  Tasks: "Subject,Due_Date,Status,What_Id,Owner",
} as const;
const pageSchema = z.object({
  data: z.array(z.unknown()),
  info: z.object({ more_records: z.boolean() }),
});
export async function fetchZohoSnapshot(config: ZohoConfig, request: typeof fetch = fetch) {
  const timedRequest: typeof fetch = async (url, init) => {
    try {
      return await request(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
    } catch {
      throw new Error("Zoho could not be reached. Your saved dashboard is unchanged.");
    }
  };
  async function safeJson(response: Response) {
    try {
      return await response.json();
    } catch {
      throw new Error("Zoho returned an unreadable response. Your saved dashboard is unchanged.");
    }
  }
  const auth = await timedRequest(`https://accounts.zoho.${config.region}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    }),
  });
  const token = z.object({ access_token: z.string().min(1) }).safeParse(await safeJson(auth));
  if (!auth.ok || !token.success)
    throw new Error("Zoho authorization failed. Check the server connection settings.");
  async function records(module: keyof typeof fields) {
    const rows: unknown[] = [];
    for (let page = 1; page <= 10; page++) {
      const params = new URLSearchParams({
        fields: fields[module],
        per_page: "200",
        page: String(page),
      });
      const response = await timedRequest(
        `https://www.zohoapis.${config.region}/crm/v8/${module}?${params}`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${token.data!.access_token}` },
        },
      );
      if (response.status === 204) return rows;
      if (!response.ok)
        throw new Error(
          `Zoho ${module} could not be read (HTTP ${response.status}). Check read permissions and API limits.`,
        );
      const parsed = pageSchema.safeParse(await safeJson(response));
      if (!parsed.success)
        throw new Error(
          `Zoho ${module} returned an unsupported response. Your saved dashboard is unchanged.`,
        );
      rows.push(...parsed.data.data);
      if (!parsed.data.info.more_records) return rows;
    }
    throw new Error(
      `Zoho ${module} exceeds the 2,000-record dashboard limit. No partial snapshot was saved.`,
    );
  }
  const accounts = await records("Accounts");
  const contacts = await records("Contacts");
  const deals = await records("Deals");
  const tasks = await records("Tasks");
  try {
    return zohoSnapshotSchema.parse({
      fetchedAt: new Date().toISOString(),
      orgId: config.orgId,
      region: config.region,
      accounts: accounts.map((row) => {
        const r = account.parse(row);
        return {
          id: r.id,
          name: r.Account_Name,
          owner: r.Owner?.name ?? "",
          phone: r.Phone ?? "",
          website: r.Website ?? "",
        };
      }),
      contacts: contacts.map((row) => {
        const r = contact.parse(row);
        return {
          id: r.id,
          name: [r.First_Name, r.Last_Name].filter(Boolean).join(" "),
          owner: r.Owner?.name ?? "",
          account: r.Account_Name?.name ?? "",
          email: r.Email ?? "",
          phone: r.Phone ?? "",
        };
      }),
      deals: deals.map((row) => {
        const r = deal.parse(row);
        return {
          id: r.id,
          name: r.Deal_Name,
          owner: r.Owner?.name ?? "",
          account: r.Account_Name?.name ?? "",
          stage: r.Stage,
          closed: config.closedStages.includes(r.Stage),
          amount: r.Amount ?? null,
          currency: r.Currency || config.currency,
          closeDate: r.Closing_Date ?? "",
        };
      }),
      tasks: tasks.map((row) => {
        const r = task.parse(row);
        return {
          id: r.id,
          name: r.Subject,
          owner: r.Owner?.name ?? "",
          dueDate: r.Due_Date ?? "",
          status: r.Status,
          done: r.Status === "Completed",
          related: r.What_Id?.name ?? "",
        };
      }),
    });
  } catch {
    throw new Error(
      "Zoho fields could not be mapped. Check field names, currency and record IDs. Your saved dashboard is unchanged.",
    );
  }
}
let inFlight: Promise<ReturnType<typeof zohoSnapshotSchema.parse>> | null = null;
let lastAttempt = 0;
export async function refreshZoho(config: ZohoConfig) {
  if (inFlight) return inFlight;
  if (Date.now() - lastAttempt < 60000)
    throw new Error("Wait one minute before refreshing Zoho again.");
  lastAttempt = Date.now();
  inFlight = fetchZohoSnapshot(config);
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
