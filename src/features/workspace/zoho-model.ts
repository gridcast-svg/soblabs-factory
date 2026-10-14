import { z } from "zod";
export const zohoId = z.string().regex(/^\d+$/, "Zoho IDs must be strings of digits");
export const zohoRegions = ["com", "ca", "eu", "in", "com.au", "jp", "com.cn", "sa"] as const;
const record = z.object({ id: zohoId, name: z.string(), owner: z.string() });
export const zohoSnapshotSchema = z
  .object({
    fetchedAt: z.string().datetime(),
    orgId: zohoId,
    region: z.enum(zohoRegions),
    accounts: z.array(record.extend({ phone: z.string(), website: z.string() })),
    contacts: z.array(record.extend({ email: z.string(), phone: z.string(), account: z.string() })),
    deals: z.array(
      record.extend({
        account: z.string(),
        stage: z.string(),
        closed: z.boolean(),
        amount: z.number().finite().nonnegative().nullable(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        closeDate: z.string(),
      }),
    ),
    tasks: z.array(
      record.extend({
        dueDate: z.string(),
        status: z.string(),
        done: z.boolean(),
        related: z.string(),
      }),
    ),
  })
  .superRefine((snapshot, ctx) => {
    for (const module of ["accounts", "contacts", "deals", "tasks"] as const) {
      const rows = snapshot[module];
      if (new Set(rows.map((r) => r.id)).size !== rows.length)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate Zoho ${module} IDs` });
    }
  });
export type ZohoSnapshot = z.infer<typeof zohoSnapshotSchema>;
export type ZohoModule = "Accounts" | "Contacts" | "Deals" | "Tasks";
export function zohoRecordUrl(
  snapshot: Pick<ZohoSnapshot, "region" | "orgId">,
  module: ZohoModule,
  id?: string,
) {
  const region = z.enum(zohoRegions).parse(snapshot.region);
  const orgId = zohoId.parse(snapshot.orgId);
  return `https://crm.zoho.${region}/crm/org${orgId}/tab/${module}${id ? "/" + zohoId.parse(id) : ""}`;
}
export function zohoPipelineTotals(snapshot: ZohoSnapshot) {
  const totals: Record<string, number> = {};
  for (const deal of snapshot.deals) {
    if (!deal.closed && deal.amount !== null)
      totals[deal.currency] = (totals[deal.currency] ?? 0) + deal.amount;
  }
  return totals;
}
