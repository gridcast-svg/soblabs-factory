import { useMemo, useState } from "react";
import {
  Plus,
  X,
  Search,
  Upload,
  Download,
  Building2,
  Users,
  TrendingUp,
  CalendarCheck,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./store";
import { blankProject } from "./model";
import {
  blankAccount,
  blankContact,
  blankDeal,
  blankActivity,
  accountSchema,
  contactSchema,
  dealSchema,
  activitySchema,
  dealStages,
} from "./crm-model";
import type { Account, Contact, Deal, Activity } from "./crm-model";
import { accountInUse, convertLead, preserveAccountLinks, safeWebsite } from "./crm-operations";
import { readAccountFile, exportAccounts } from "./crm-import";
import type { AccountFile } from "./crm-import";
import { CrmImport } from "./CrmImport";
import { Metric } from "./Bom";
import { formatMoney } from "./format";
import "./crm.css";
type Tab = "Accounts" | "Contacts" | "Leads" | "Deals" | "Activities";
type Editor =
  | { type: "account"; value: Account }
  | { type: "contact"; value: Contact }
  | { type: "deal"; value: Deal }
  | { type: "activity"; value: Activity };
export function Crm() {
  const { state, setState, mode, selectProject } = useWorkspace();
  const [tab, setTab] = useState<Tab>("Accounts");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("");
  const [filter, setFilter] = useState("All");
  const [edit, setEdit] = useState<Editor | null>(null);
  const [file, setFile] = useState<AccountFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [convert, setConvert] = useState<Contact | null>(null);
  const [conversionAccount, setConversionAccount] = useState("");
  const [conversionDeal, setConversionDeal] = useState(true);
  const accounts = state.accounts,
    contacts = state.contacts,
    deals = state.deals,
    activities = state.activities;
  const query = search.toLocaleLowerCase();
  const visible = (record: unknown) => JSON.stringify(record).toLocaleLowerCase().includes(query);
  const owners = useMemo(
    () =>
      [
        ...new Set(
          [...accounts, ...contacts, ...deals, ...activities].map((r) => r.owner).filter(Boolean),
        ),
      ].sort(),
    [accounts, contacts, deals, activities],
  );
  const owned = (r: { owner: string }) => !owner || r.owner === owner;
  const accountName = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name ?? "Unassigned account";
  const filteredAccounts = accounts.filter(
    (a) => visible([a.name, a.phone, a.website, a.owner, a.industry, a.type]) && owned(a),
  );
  const filteredContacts = contacts.filter(
    (c) =>
      c.kind === (tab === "Leads" ? "Lead" : "Contact") &&
      visible([c.name, c.company, c.email, c.phone, c.owner]) &&
      owned(c) &&
      (filter === "All" || c.stage === filter),
  );
  const filteredDeals = deals.filter(
    (d) =>
      visible([d.name, accountName(d.accountId), d.owner]) &&
      owned(d) &&
      (filter === "All" || d.stage === filter),
  );
  const filteredActivities = activities.filter(
    (a) =>
      visible([a.subject, a.type, a.owner, accountName(a.accountId)]) &&
      owned(a) &&
      (filter === "All" || (filter === "Open" ? !a.done : a.done)),
  );
  async function importFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      setFile(await readAccountFile(f));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to read export");
    } finally {
      setBusy(false);
    }
  }
  function create() {
    if (tab === "Accounts") setEdit({ type: "account", value: blankAccount() });
    else if (tab === "Deals") setEdit({ type: "deal", value: blankDeal() });
    else if (tab === "Activities") setEdit({ type: "activity", value: blankActivity() });
    else setEdit({ type: "contact", value: blankContact(tab === "Leads" ? "Lead" : "Contact") });
  }
  function remove() {
    if (!edit) return;
    const id = edit.value.id;
    if (
      (edit.type === "account" && accountInUse(state, id)) ||
      (edit.type === "contact" &&
        (deals.some((d) => d.contactId === id) || activities.some((a) => a.contactId === id))) ||
      (edit.type === "deal" && activities.some((a) => a.dealId === id))
    ) {
      toast.error(
        "This record has related records. Reassign or remove those links before deleting it.",
      );
      return;
    }
    if (!confirm("Delete this CRM record?")) return;
    setState({
      ...state,
      accounts: edit.type === "account" ? accounts.filter((a) => a.id !== id) : accounts,
      contacts: edit.type === "contact" ? contacts.filter((c) => c.id !== id) : contacts,
      deals: edit.type === "deal" ? deals.filter((d) => d.id !== id) : deals,
      activities: edit.type === "activity" ? activities.filter((a) => a.id !== id) : activities,
    });
    setEdit(null);
  }
  function save() {
    if (!edit) return;
    try {
      const now = new Date().toISOString();
      if (edit.type === "account") {
        const value = accountSchema.parse({ ...edit.value, updatedAt: now });
        setState(
          accounts.some((a) => a.id === value.id)
            ? preserveAccountLinks(state, value)
            : { ...state, accounts: [...accounts, value] },
        );
      } else if (edit.type === "contact") {
        const value = contactSchema.parse({
          ...edit.value,
          company: edit.value.accountId ? accountName(edit.value.accountId) : edit.value.company,
          updatedAt: now,
        });
        setState({
          ...state,
          contacts: contacts.some((c) => c.id === value.id)
            ? contacts.map((c) => (c.id === value.id ? value : c))
            : [...contacts, value],
        });
      } else if (edit.type === "deal") {
        const value = dealSchema.parse({ ...edit.value, updatedAt: now });
        setState({
          ...state,
          deals: deals.some((d) => d.id === value.id)
            ? deals.map((d) => (d.id === value.id ? value : d))
            : [...deals, value],
        });
      } else {
        const value = activitySchema.parse({ ...edit.value, updatedAt: now });
        setState({
          ...state,
          activities: activities.some((a) => a.id === value.id)
            ? activities.map((a) => (a.id === value.id ? value : a))
            : [...activities, value],
        });
      }
      setEdit(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check record fields");
    }
  }
  function update(key: string, value: unknown) {
    if (edit) setEdit({ ...edit, value: { ...edit.value, [key]: value } } as Editor);
  }
  function linkedActivity(
    accountId: string | null,
    contactId: string | null = null,
    dealId: string | null = null,
  ) {
    setEdit({ type: "activity", value: { ...blankActivity(), accountId, contactId, dealId } });
  }
  const openDeals = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
  const total = (currency: "CAD" | "USD") =>
    openDeals.filter((d) => d.currency === currency).reduce((sum, d) => sum + (d.amount ?? 0), 0);
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>Customer relationships</h2>
          <p>Accounts, people, opportunities, and the next steps that move projects forward.</p>
        </div>
        <div className="ws-actions">
          {tab === "Accounts" && (
            <>
              <label className="ws-button">
                <Upload size={15} />
                {busy ? "Reading…" : "Import Zoho accounts"}
                <input
                  hidden
                  type="file"
                  accept=".csv,.xlsx,.json"
                  disabled={busy}
                  onChange={(e) => {
                    void importFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                className="ws-button"
                disabled={!filteredAccounts.length}
                onClick={() =>
                  void exportAccounts(filteredAccounts).catch((e) => toast.error(e.message))
                }
              >
                <Download size={15} />
                Export accounts
              </button>
            </>
          )}
          <button className="ws-button primary" onClick={create}>
            <Plus size={15} />
            Add {tab === "Activities" ? "activity" : tab.slice(0, -1).toLowerCase()}
          </button>
        </div>
      </div>
      <div className="ws-callout">
        {mode === "sandbox"
          ? "This sandbox stores CRM records in this browser. Use a sample export to review the workflow; secure shared storage is still required for production customer records."
          : "CRM records are saved in your private account workspace."}{" "}
        Zoho imports are manual; live Zoho sync, Microsoft 365 email capture, and daily updates are
        not connected.
      </div>
      <div className="ws-metrics">
        <Metric label="Company accounts" value={String(accounts.length)} />
        <Metric
          label="Active leads"
          value={String(contacts.filter((c) => c.kind === "Lead" && c.stage !== "Lost").length)}
        />
        <Metric label="Open deals · CAD" value={formatMoney(total("CAD"), "CAD")} />
        <Metric label="Open deals · USD" value={formatMoney(total("USD"), "USD")} />
      </div>
      <div className="crm-tabs" role="tablist" aria-label="CRM modules">
        {(
          [
            { name: "Accounts", icon: Building2 },
            { name: "Contacts", icon: Users },
            { name: "Leads", icon: TrendingUp },
            { name: "Deals", icon: TrendingUp },
            { name: "Activities", icon: CalendarCheck },
          ] as const
        ).map(({ name, icon: Icon }) => (
          <button
            role="tab"
            aria-selected={tab === name}
            key={name}
            onClick={() => {
              setTab(name);
              setFilter("All");
            }}
          >
            <Icon size={16} />
            {name}
            <span>
              {name === "Accounts"
                ? accounts.length
                : name === "Deals"
                  ? deals.length
                  : name === "Activities"
                    ? activities.length
                    : contacts.filter((c) => c.kind === (name === "Leads" ? "Lead" : "Contact"))
                        .length}
            </span>
          </button>
        ))}
      </div>
      <div className="ws-toolbar crm-toolbar">
        <Search size={16} />
        <input
          aria-label="Search CRM"
          placeholder={`Search ${tab.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        {tab !== "Accounts" && (
          <select
            aria-label="Filter CRM status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All</option>
            {(tab === "Deals"
              ? dealStages
              : tab === "Activities"
                ? ["Open", "Completed"]
                : ["Lead", "Qualified", "Proposal", "Won", "Lost"]
            ).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      {tab === "Accounts" ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Account / Industry</th>
                <th>Phone / Website</th>
                <th>Owner</th>
                <th>Contacts</th>
                <th>Open deals</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <button
                      className="ws-text-button"
                      onClick={() => setEdit({ type: "account", value: a })}
                    >
                      {a.name}
                    </button>
                    <small>
                      {a.industry || "Industry not set"}
                      {a.type ? " · " + a.type : ""}
                    </small>
                  </td>
                  <td>
                    {a.phone || "—"}
                    <small>
                      {safeWebsite(a.website) ? (
                        <a href={safeWebsite(a.website)!} target="_blank" rel="noopener noreferrer">
                          {a.website}
                        </a>
                      ) : (
                        a.website || "—"
                      )}
                    </small>
                  </td>
                  <td>{a.owner || "Unassigned"}</td>
                  <td>
                    {contacts.filter((c) => c.accountId === a.id && c.kind === "Contact").length}
                  </td>
                  <td>{openDeals.filter((d) => d.accountId === a.id).length}</td>
                  <td>
                    {a.source}
                    <small>{a.sourceId}</small>
                  </td>
                  <td>
                    <button
                      className="ws-icon-button"
                      aria-label={`Add activity for ${a.name}`}
                      onClick={() => linkedActivity(a.id)}
                    >
                      <CalendarCheck size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredAccounts.length && (
            <div className="ws-empty">
              <Building2 size={28} />
              <p>No accounts match. Add a company or import a Zoho account export.</p>
            </div>
          )}
        </div>
      ) : tab === "Contacts" || tab === "Leads" ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Name / Title</th>
                <th>Account / Company</th>
                <th>Email / Phone</th>
                <th>Owner</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button
                      className="ws-text-button"
                      onClick={() => setEdit({ type: "contact", value: c })}
                    >
                      {c.name}
                    </button>
                    <small>{c.title}</small>
                  </td>
                  <td>{c.accountId ? accountName(c.accountId) : c.company || "Unassigned"}</td>
                  <td>
                    {c.email || "—"}
                    <small>{c.phone}</small>
                  </td>
                  <td>{c.owner || "Unassigned"}</td>
                  <td>
                    <span className="ws-badge">{c.stage}</span>
                  </td>
                  <td>
                    <div className="ws-actions">
                      {tab === "Leads" && (
                        <button
                          className="ws-button"
                          onClick={() => {
                            setConvert(c);
                            setConversionAccount(c.accountId ?? "");
                          }}
                        >
                          Convert lead
                        </button>
                      )}
                      <button
                        className="ws-icon-button"
                        aria-label={`Add activity for ${c.name}`}
                        onClick={() => linkedActivity(c.accountId, c.id)}
                      >
                        <CalendarCheck size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredContacts.length && (
            <div className="ws-empty">
              <Users size={28} />
              <p>No {tab.toLowerCase()} match your filters.</p>
            </div>
          )}
        </div>
      ) : tab === "Deals" ? (
        <div className="ws-pipeline crm-deal-pipeline">
          {dealStages.map((stage) => (
            <section className="ws-pipeline-column" key={stage}>
              <h3>
                {stage}
                <span>{filteredDeals.filter((d) => d.stage === stage).length}</span>
              </h3>
              {filteredDeals
                .filter((d) => d.stage === stage)
                .map((d) => (
                  <button
                    className="ws-contact-card"
                    key={d.id}
                    onClick={() => setEdit({ type: "deal", value: d })}
                  >
                    <strong>{d.name}</strong>
                    <span>{accountName(d.accountId)}</span>
                    <b>{d.amount === null ? "Value not set" : formatMoney(d.amount, d.currency)}</b>
                    <small>
                      {d.closeDate || "Close date not set"} · {d.owner || "Unassigned"}
                    </small>
                  </button>
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Done</th>
                <th>Activity / Type</th>
                <th>Related account / Deal</th>
                <th>Owner</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input
                      aria-label={`Complete ${a.subject}`}
                      type="checkbox"
                      checked={a.done}
                      onChange={(e) =>
                        setState({
                          ...state,
                          activities: activities.map((x) =>
                            x.id === a.id
                              ? {
                                  ...x,
                                  done: e.target.checked,
                                  updatedAt: new Date().toISOString(),
                                }
                              : x,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="ws-text-button"
                      onClick={() => setEdit({ type: "activity", value: a })}
                    >
                      {a.subject}
                    </button>
                    <small>{a.type}</small>
                  </td>
                  <td>
                    {accountName(a.accountId)}
                    <small>{deals.find((d) => d.id === a.dealId)?.name}</small>
                  </td>
                  <td>{a.owner || "Unassigned"}</td>
                  <td>
                    <span
                      className={
                        !a.done &&
                        a.dueDate &&
                        a.dueDate < new Intl.DateTimeFormat("en-CA").format(new Date())
                          ? "ws-warning"
                          : ""
                      }
                    >
                      {a.dueDate || "No due date"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredActivities.length && (
            <div className="ws-empty">
              <CalendarCheck size={28} />
              <p>No activities match. Add a task, call, meeting, email log, or note.</p>
            </div>
          )}
        </div>
      )}
      {edit && (
        <div className="ws-modal-backdrop">
          <form
            className="ws-modal crm-record-modal"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="ws-section-heading">
              <div>
                <h2>
                  {edit.type === "account"
                    ? "Account details"
                    : edit.type === "contact"
                      ? `${edit.value.kind} details`
                      : edit.type === "deal"
                        ? "Deal details"
                        : "Activity details"}
                </h2>
                <p>
                  {edit.type === "account" && edit.value.sourceId
                    ? `Zoho Account ID: ${edit.value.sourceId}`
                    : "Edit record and related information."}
                </p>
              </div>
              <button
                type="button"
                className="ws-icon-button"
                aria-label="Close CRM editor"
                onClick={() => setEdit(null)}
              >
                <X />
              </button>
            </div>
            <div className="ws-form-grid">
              {edit.type === "account" ? (
                <>
                  {textField("name", "Account name", edit.value.name, update, true)}
                  {textField("owner", "Account owner", edit.value.owner, update)}
                  {textField("phone", "Phone", edit.value.phone, update)}
                  {textField("website", "Website", edit.value.website, update)}
                  {textField("industry", "Industry", edit.value.industry, update)}
                  {textField("type", "Account type", edit.value.type, update)}
                  {textField("billingStreet", "Billing street", edit.value.billingStreet, update)}
                  {textField("billingCity", "Billing city", edit.value.billingCity, update)}
                  {textField(
                    "billingRegion",
                    "Billing province / state",
                    edit.value.billingRegion,
                    update,
                  )}
                  {textField(
                    "billingPostalCode",
                    "Billing postal code",
                    edit.value.billingPostalCode,
                    update,
                  )}
                  {textField(
                    "billingCountry",
                    "Billing country",
                    edit.value.billingCountry,
                    update,
                  )}
                </>
              ) : edit.type === "contact" ? (
                <>
                  {textField("name", "Name", edit.value.name, update, true)}
                  <label>
                    Account
                    <select
                      value={edit.value.accountId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value || null;
                        setEdit({
                          ...edit,
                          value: {
                            ...edit.value,
                            accountId: id,
                            company: accounts.find((a) => a.id === id)?.name ?? edit.value.company,
                          },
                        });
                      }}
                    >
                      <option value="">Unassigned</option>
                      {accounts.map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {textField("company", "Company", edit.value.company, update)}
                  {textField("email", "Email", edit.value.email, update, false, "email")}
                  {textField("phone", "Phone", edit.value.phone, update)}
                  {textField("title", "Job title", edit.value.title, update)}
                  {textField("owner", "Owner", edit.value.owner, update)}
                  <label>
                    Status
                    <select
                      value={edit.value.stage}
                      onChange={(e) => update("stage", e.target.value)}
                    >
                      {["Lead", "Qualified", "Proposal", "Won", "Lost"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : edit.type === "deal" ? (
                <>
                  {textField("name", "Deal name", edit.value.name, update, true)}
                  <AccountSelect
                    value={edit.value.accountId}
                    onChange={(id) => update("accountId", id)}
                  />
                  <label>
                    Primary contact
                    <select
                      value={edit.value.contactId ?? ""}
                      onChange={(e) => update("contactId", e.target.value || null)}
                    >
                      <option value="">None</option>
                      {contacts
                        .filter((c) => c.kind === "Contact")
                        .map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name} · {c.company}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Stage
                    <select
                      value={edit.value.stage}
                      onChange={(e) => update("stage", e.target.value)}
                    >
                      {dealStages.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Deal value
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={edit.value.amount ?? ""}
                      placeholder="Unknown"
                      onChange={(e) =>
                        update("amount", e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Currency
                    <select
                      value={edit.value.currency}
                      onChange={(e) => update("currency", e.target.value)}
                    >
                      <option>CAD</option>
                      <option>USD</option>
                    </select>
                  </label>
                  {textField(
                    "closeDate",
                    "Expected close date",
                    edit.value.closeDate,
                    update,
                    false,
                    "date",
                  )}
                  {textField("owner", "Deal owner", edit.value.owner, update)}
                  <label>
                    Linked project
                    <select
                      value={edit.value.projectId ?? ""}
                      onChange={(e) => update("projectId", e.target.value || null)}
                    >
                      <option value="">None</option>
                      {state.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  {textField("subject", "Subject", edit.value.subject, update, true)}
                  <label>
                    Activity type
                    <select
                      value={edit.value.type}
                      onChange={(e) => update("type", e.target.value)}
                    >
                      {["Task", "Call", "Meeting", "Email", "Note"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <AccountSelect
                    value={edit.value.accountId}
                    onChange={(id) => update("accountId", id)}
                  />
                  <label>
                    Contact
                    <select
                      value={edit.value.contactId ?? ""}
                      onChange={(e) => update("contactId", e.target.value || null)}
                    >
                      <option value="">None</option>
                      {contacts.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Deal
                    <select
                      value={edit.value.dealId ?? ""}
                      onChange={(e) => update("dealId", e.target.value || null)}
                    >
                      <option value="">None</option>
                      {deals.map((d) => (
                        <option value={d.id} key={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Project
                    <select
                      value={edit.value.projectId ?? ""}
                      onChange={(e) => update("projectId", e.target.value || null)}
                    >
                      <option value="">None</option>
                      {state.projects.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {textField("owner", "Activity owner", edit.value.owner, update)}
                  {textField("dueDate", "Due date", edit.value.dueDate, update, false, "date")}
                  <label className="ws-checkbox">
                    <input
                      type="checkbox"
                      checked={edit.value.done}
                      onChange={(e) => update("done", e.target.checked)}
                    />
                    Completed
                  </label>
                  <p className="ws-footnote">
                    Email activities log correspondence; no email is sent.
                  </p>
                </>
              )}
              <label className="wide">
                Notes
                <textarea
                  value={edit.value.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </label>
            </div>
            {edit.type === "account" && (
              <div className="crm-related">
                <h3>Related records</h3>
                <p>
                  {contacts.filter((c) => c.accountId === edit.value.id).length} contacts / leads ·{" "}
                  {deals.filter((d) => d.accountId === edit.value.id).length} deals ·{" "}
                  {activities.filter((a) => a.accountId === edit.value.id).length} activities
                </p>
                {contacts
                  .filter((c) => c.accountId === edit.value.id)
                  .map((c) => (
                    <button
                      type="button"
                      className="ws-text-button"
                      key={c.id}
                      onClick={() => setEdit({ type: "contact", value: c })}
                    >
                      {c.name}
                    </button>
                  ))}
                {deals
                  .filter((d) => d.accountId === edit.value.id)
                  .map((d) => (
                    <button
                      type="button"
                      className="ws-text-button"
                      key={d.id}
                      onClick={() => setEdit({ type: "deal", value: d })}
                    >
                      {d.name} · {d.stage}
                    </button>
                  ))}
                {state.projects
                  .filter((p) => p.accountId === edit.value.id)
                  .map((p) => (
                    <p key={p.id}>Project: {p.name}</p>
                  ))}
                {activities
                  .filter((a) => a.accountId === edit.value.id)
                  .map((a) => (
                    <button
                      type="button"
                      className="ws-text-button"
                      key={a.id}
                      onClick={() => setEdit({ type: "activity", value: a })}
                    >
                      {a.subject} · {a.done ? "Completed" : "Open"}
                    </button>
                  ))}
                {Object.keys(edit.value.sourceFields).length > 0 && (
                  <details>
                    <summary>Original imported fields</summary>
                    <dl>
                      {Object.entries(edit.value.sourceFields).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </div>
            )}
            <div className="ws-actions">
              <button className="ws-button primary" type="submit">
                Save {edit.type === "contact" ? edit.value.kind.toLowerCase() : edit.type}
              </button>
              {edit.type === "deal" &&
                edit.value.stage === "Won" &&
                !edit.value.projectId &&
                deals.some((d) => d.id === edit.value.id) && (
                  <button
                    type="button"
                    className="ws-button"
                    onClick={() => {
                      if (edit.type !== "deal") return;
                      const value = dealSchema.parse(edit.value);
                      const p = {
                        ...blankProject(value.name),
                        accountId: value.accountId,
                        customer:
                          accountName(value.accountId) === "Unassigned account"
                            ? ""
                            : accountName(value.accountId),
                        currency: value.currency,
                      };
                      setState({
                        ...state,
                        projects: [...state.projects, p],
                        deals: deals.map((d) =>
                          d.id === value.id ? { ...value, projectId: p.id } : d,
                        ),
                      });
                      selectProject(p.id);
                      setEdit({ ...edit, value: { ...value, projectId: p.id } });
                      toast.success("Project created and linked to the deal");
                    }}
                  >
                    <ArrowUpRight size={15} />
                    Create project
                  </button>
                )}
              <button type="button" className="ws-button" onClick={remove}>
                <Trash2 size={14} />
                Delete record
              </button>
            </div>
          </form>
        </div>
      )}
      {file && <CrmImport file={file} onClose={() => setFile(null)} />}
      {convert && (
        <div className="ws-modal-backdrop">
          <div className="ws-modal">
            <div className="ws-section-heading">
              <h2>Convert lead</h2>
              <button
                className="ws-icon-button"
                aria-label="Close lead conversion"
                onClick={() => setConvert(null)}
              >
                <X />
              </button>
            </div>
            <p>
              {convert.name} · {convert.company || "Company not set"}
            </p>
            <label>
              Account
              <select
                value={conversionAccount}
                onChange={(e) => setConversionAccount(e.target.value)}
              >
                <option value="">Match company name or create its account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ws-checkbox">
              <input
                type="checkbox"
                checked={conversionDeal}
                onChange={(e) => setConversionDeal(e.target.checked)}
              />
              Create a linked opportunity
            </label>
            <p className="ws-footnote">
              The lead becomes a contact. Existing activities and notes stay linked to the same
              person.
            </p>
            <button
              className="ws-button primary"
              onClick={() => {
                try {
                  setState(
                    convertLead(state, convert.id, conversionAccount || null, conversionDeal),
                  );
                  setConvert(null);
                  toast.success("Lead converted");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Unable to convert lead");
                }
              }}
            >
              Confirm conversion
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function textField(
  key: string,
  label: string,
  value: string,
  onChange: (key: string, value: unknown) => void,
  required = false,
  type = "text",
) {
  return (
    <label key={key}>
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(key, e.target.value)}
      />
    </label>
  );
}
function AccountSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { state } = useWorkspace();
  return (
    <label>
      Account
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Unassigned</option>
        {state.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
