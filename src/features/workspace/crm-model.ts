import { z } from "zod";
const text = z.string().default("");
const reference = z.string().nullable().default(null);
const source = {
  source: z.enum(["Manual", "Zoho"]).default("Manual"),
  sourceId: text,
  sourceFields: z.record(z.string()).default({}),
};
export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  phone: text,
  website: text,
  industry: text,
  type: text,
  owner: text,
  billingStreet: text,
  billingCity: text,
  billingRegion: text,
  billingPostalCode: text,
  billingCountry: text,
  notes: text,
  createdAt: text,
  updatedAt: text,
  ...source,
});
export type Account = z.infer<typeof accountSchema>;
export const contactSchema = z.object({
  id: z.string().min(1),
  company: z.string(),
  name: z.string(),
  email: z.string(),
  stage: z.enum(["Lead", "Qualified", "Proposal", "Won", "Lost"]),
  notes: z.string(),
  accountId: reference,
  phone: text,
  title: text,
  owner: text,
  kind: z.enum(["Contact", "Lead"]).default("Contact"),
  createdAt: text,
  updatedAt: text,
  ...source,
});
export type Contact = z.infer<typeof contactSchema>;
export const dealStages = [
  "Qualification",
  "Needs analysis",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export const dealSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  accountId: reference,
  contactId: reference,
  projectId: reference,
  amount: z.number().finite().nonnegative().nullable().default(null),
  currency: z.enum(["CAD", "USD"]).default("CAD"),
  stage: z.enum(dealStages).default("Qualification"),
  closeDate: text,
  owner: text,
  notes: text,
  createdAt: text,
  updatedAt: text,
  ...source,
});
export type Deal = z.infer<typeof dealSchema>;
export const activitySchema = z.object({
  id: z.string().min(1),
  subject: z.string().trim().min(1),
  type: z.enum(["Task", "Call", "Meeting", "Email", "Note"]).default("Task"),
  accountId: reference,
  contactId: reference,
  dealId: reference,
  projectId: reference,
  owner: text,
  dueDate: text,
  done: z.boolean().default(false),
  notes: text,
  createdAt: text,
  updatedAt: text,
});
export type Activity = z.infer<typeof activitySchema>;
const timestamp = () => new Date().toISOString();
export function blankAccount(name = ""): Account {
  return accountSchema.parse({
    id: crypto.randomUUID(),
    name: name || "New account",
    createdAt: timestamp(),
    updatedAt: timestamp(),
  });
}
export function blankContact(kind: "Contact" | "Lead" = "Contact"): Contact {
  return contactSchema.parse({
    id: crypto.randomUUID(),
    company: "",
    email: "",
    stage: "Lead",
    notes: "",
    kind,
    createdAt: timestamp(),
    updatedAt: timestamp(),
    name: "New " + kind.toLowerCase(),
  });
}
export function blankDeal(): Deal {
  return dealSchema.parse({
    id: crypto.randomUUID(),
    name: "New opportunity",
    createdAt: timestamp(),
    updatedAt: timestamp(),
  });
}
export function blankActivity(): Activity {
  return activitySchema.parse({
    id: crypto.randomUUID(),
    subject: "New follow-up",
    createdAt: timestamp(),
    updatedAt: timestamp(),
  });
}
