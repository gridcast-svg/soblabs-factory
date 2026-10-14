import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { refreshZohoDashboard } from "@/lib/zoho.functions";
import { useWorkspace } from "./store";
import { Crm } from "./Crm";
import { Metric } from "./Bom";
import { zohoPipelineTotals, zohoRecordUrl, zohoSnapshotSchema } from "./zoho-model";
import type { ZohoModule } from "./zoho-model";
import { formatMoney } from "./format";
import "./crm.css";
export function ZohoDashboard({ onOpenProject }: { onOpenProject: () => void }) {
  const { state, setState, mode, selectProject } = useWorkspace();
  const refresh = useServerFn(refreshZohoDashboard);
  const latest = useRef(state);
  const mounted = useRef(true);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [legacy, setLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ZohoModule>("Deals");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("");
  const snapshot = mode === "account" ? state.zohoSnapshot : undefined;
  const totals = snapshot ? zohoPipelineTotals(snapshot) : {};
  async function reload() {
    if (mode !== "account" || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = zohoSnapshotSchema.parse(await refresh());
      if (!mounted.current) return;
      const previous = latest.current.zohoSnapshot;
      if (previous && (previous.orgId !== next.orgId || previous.region !== next.region)) {
        throw new Error(
          "This connection belongs to a different Zoho organization. Keep the existing workspace and use a separate workspace for that organization.",
        );
      }
      setState({ ...latest.current, zohoSnapshot: next });
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Zoho refresh failed. Try again later.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (legacy)
    return (
      <>
        <button className="ws-button" onClick={() => setLegacy(false)}>
          Back to Zoho dashboard
        </button>
        <p className="ws-footnote">
          Previously saved Factory records. These are separate from the read-only Zoho dashboard.
        </p>
        <Crm />
      </>
    );
  const rows = snapshot
    ? snapshot[
        tab === "Accounts"
          ? "accounts"
          : tab === "Contacts"
            ? "contacts"
            : tab === "Deals"
              ? "deals"
              : "tasks"
      ]
    : [];
  const owners = [...new Set(rows.map((r) => r.owner).filter(Boolean))].sort();
  const filtered = rows.filter(
    (r) =>
      (!owner || r.owner === owner) &&
      JSON.stringify(r).toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const open = (module: ZohoModule, id?: string) =>
    snapshot ? zohoRecordUrl(snapshot, module, id) : "";
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <div className="ws-eyebrow">SALES IN ZOHO · DELIVERY IN FACTORY</div>
          <h2>Zoho CRM dashboard</h2>
          <p>Review sales here. Manage customers and deals in Zoho.</p>
        </div>
        <div className="ws-actions">
          {snapshot && (
            <a className="ws-button" href={open("Deals")} target="_blank" rel="noopener noreferrer">
              Open Zoho <ArrowUpRight size={15} />
            </a>
          )}
          <button
            className="ws-button primary"
            disabled={busy || mode !== "account"}
            onClick={() => void reload()}
          >
            <RefreshCw size={15} />
            {busy ? "Refreshing…" : "Refresh Zoho"}
          </button>
        </div>
      </div>
      <div className="ws-card zoho-connection">
        <span className="ws-badge">{snapshot ? "Saved Zoho snapshot" : "Not connected"}</span>
        <p>
          {mode === "sandbox"
            ? "Live Zoho data requires account sign-in. This design sandbox does not retrieve customer records."
            : snapshot
              ? "Read-only snapshot. Refresh to check for changes; edits open in Zoho."
              : "Connect Zoho through secure server settings, then select Refresh Zoho. Your existing Factory records remain available below."}
        </p>
        <p className="ws-footnote">
          Last updated: {snapshot ? new Date(snapshot.fetchedAt).toLocaleString("en-CA") : "Never"}
        </p>
        {mode === "sandbox" && (
          <a className="ws-button" href="/auth">
            Account sign in
          </a>
        )}
        {error && (
          <p role="alert" className="crm-error">
            {error} {snapshot && "The previous snapshot is still shown."}
          </p>
        )}
      </div>
      <div className="ws-metrics zoho-metrics">
        <Metric label="Accounts" value={snapshot ? String(snapshot.accounts.length) : "—"} />
        <Metric
          label="Open deals"
          value={snapshot ? String(snapshot.deals.filter((d) => !d.closed).length) : "—"}
        />
        <Metric
          label="Open follow-ups"
          value={snapshot ? String(snapshot.tasks.filter((t) => !t.done).length) : "—"}
        />
        <Metric
          label="Open pipeline"
          value={
            snapshot
              ? Object.entries(totals)
                  .map(([c, n]) => `${c} ${formatMoney(n, c)}`)
                  .join(" · ") || "No valued open deals"
              : "—"
          }
        />
      </div>
      <div className="crm-tabs" role="tablist" aria-label="Zoho modules">
        {(["Deals", "Accounts", "Contacts", "Tasks"] as const).map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            onClick={() => {
              setTab(t);
              setOwner("");
            }}
          >
            {t === "Tasks" ? "Follow-ups" : t}
          </button>
        ))}
      </div>
      <div className="ws-toolbar crm-toolbar">
        <input
          aria-label="Search Zoho records"
          placeholder="Search Zoho records…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter Zoho owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr>
              <th>{tab === "Tasks" ? "Follow-up" : "Name"}</th>
              <th>Details</th>
              <th>Owner</th>
              {tab === "Deals" && <th>Factory project</th>}
              <th>Zoho</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                </td>
                <td>
                  {"stage" in r ? (
                    <>
                      {r.stage}
                      <br />
                      {r.account}
                      <br />
                      {r.amount === null
                        ? "Value not set"
                        : `${r.currency} ${formatMoney(r.amount, r.currency)}`}
                      <br />
                      {r.closeDate && `Closes ${r.closeDate}`}
                    </>
                  ) : "dueDate" in r ? (
                    <>
                      {r.status}
                      <br />
                      {r.dueDate && `Due ${r.dueDate}`}
                      <br />
                      {r.related}
                    </>
                  ) : "email" in r ? (
                    <>
                      {r.account}
                      <br />
                      {r.email}
                      <br />
                      {r.phone}
                    </>
                  ) : (
                    <>
                      {r.phone}
                      <br />
                      {r.website}
                    </>
                  )}
                </td>
                <td>{r.owner || "—"}</td>
                {tab === "Deals" && (
                  <td>
                    <select
                      aria-label={`Factory project for ${r.name}`}
                      value={state.projects.find((p) => p.zohoDealId === r.id)?.id ?? ""}
                      disabled={busy}
                      onChange={(e) => {
                        const projectId = e.target.value;
                        setState({
                          ...state,
                          projects: state.projects.map((p) => {
                            if (p.id === projectId) return { ...p, zohoDealId: r.id };
                            if (p.zohoDealId === r.id) {
                              const { zohoDealId: removed, ...rest } = p;
                              return rest;
                            }
                            return p;
                          }),
                        });
                      }}
                    >
                      <option value="">Not linked</option>
                      {state.projects
                        .filter((p) => !p.zohoDealId || p.zohoDealId === r.id)
                        .map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    {state.projects.find((p) => p.zohoDealId === r.id) && (
                      <button
                        className="ws-text-button"
                        onClick={() => {
                          selectProject(state.projects.find((p) => p.zohoDealId === r.id)!.id);
                          onOpenProject();
                        }}
                      >
                        Open project
                      </button>
                    )}
                  </td>
                )}
                <td>
                  <a href={open(tab, r.id)} target="_blank" rel="noopener noreferrer">
                    Open in Zoho <ArrowUpRight size={13} />
                  </a>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={tab === "Deals" ? 5 : 4}>
                  {snapshot
                    ? "No records match this view."
                    : "No Zoho snapshot yet. Connect your account to load sales information."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="ws-footnote">
        Project links belong to Factory. Refreshing does not change your BOMs, drawings, or Zoho
        records.
      </p>
      <button className="ws-button" onClick={() => setLegacy(true)}>
        Previously saved Factory CRM records
      </button>
    </>
  );
}
