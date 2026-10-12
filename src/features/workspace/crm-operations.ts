import type { WorkspaceState } from "./model";
import type { Account } from "./crm-model";
import { blankAccount, blankDeal } from "./crm-model";
export const normalizeName = (s: string) =>
  s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-CA");
export function convertLead(
  state: WorkspaceState,
  id: string,
  accountId: string | null,
  createOpportunity: boolean,
): WorkspaceState {
  const lead = state.contacts.find((c) => c.id === id && c.kind === "Lead");
  if (!lead) throw new Error("Lead is no longer available.");
  let accounts = state.accounts;
  let account = accounts.find((a) => a.id === accountId);
  if (accountId && !account) throw new Error("Selected account is no longer available.");
  if (!account && lead.company.trim()) {
    const matches = accounts.filter((a) => normalizeName(a.name) === normalizeName(lead.company));
    if (matches.length > 1)
      throw new Error("Multiple accounts match this company. Select an account before converting.");
    account = matches[0];
    if (!account) {
      account = blankAccount(lead.company.trim());
      accounts = [...accounts, account];
    }
  }
  const contact = {
    ...lead,
    kind: "Contact" as const,
    stage: "Qualified" as const,
    accountId: account?.id ?? null,
    company: account?.name ?? lead.company,
    updatedAt: new Date().toISOString(),
  };
  const deal = {
    ...blankDeal(),
    name: `${account?.name || lead.name} opportunity`,
    accountId: account?.id ?? null,
    contactId: lead.id,
    owner: lead.owner,
  };
  return {
    ...state,
    accounts,
    contacts: state.contacts.map((c) => (c.id === id ? contact : c)),
    deals: createOpportunity ? [...state.deals, deal] : state.deals,
  };
}
export function safeWebsite(raw: string): string | null {
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function accountInUse(state: WorkspaceState, id: string) {
  return (
    state.contacts.some((c) => c.accountId === id) ||
    state.deals.some((d) => d.accountId === id) ||
    state.activities.some((a) => a.accountId === id) ||
    state.projects.some((p) => p.accountId === id)
  );
}
export function preserveAccountLinks(state: WorkspaceState, updated: Account): WorkspaceState {
  return {
    ...state,
    accounts: state.accounts.map((a) => (a.id === updated.id ? updated : a)),
    contacts: state.contacts.map((c) =>
      c.accountId === updated.id ? { ...c, company: updated.name } : c,
    ),
    projects: state.projects.map((p) =>
      p.accountId === updated.id ? { ...p, customer: updated.name } : p,
    ),
  };
}
