import { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ListChecks,
  Workflow,
  Grid2X2,
  Projector,
  FileText,
  Settings2,
  ArrowUpRight,
  Plus,
  ChevronDown,
  Undo2,
  Download,
  Upload,
  ShieldCheck,
  CircleCheck,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceProvider, useWorkspace } from "./store";
import { Bom, Metric } from "./Bom";
import { formatMoney } from "./format";
import { Designer } from "./Designer";
import { Meetings } from "./Meetings";
import { Crm } from "./Crm";
import { DashboardStart } from "./DashboardStart";
import { Led } from "./Led";
import { Projection } from "./Projection";
import { blankProject, reconcile, totals, uid, stateSchema } from "./model";
import { download } from "./files";
import { supabase } from "@/integrations/supabase/client";
import "./workspace.css";
import "./boldcase.css";
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "crm", label: "CRM", icon: Users },
  { id: "bom", label: "Bill of materials", icon: ListChecks },
  { id: "designer", label: "System designer", icon: Workflow },
  { id: "led", label: "LED configurator", icon: Grid2X2 },
  { id: "projection", label: "Projection planner", icon: Projector },
  { id: "meetings", label: "Meeting notes", icon: FileText },
  { id: "settings", label: "Settings & integrations", icon: Settings2 },
] as const;
type Page = (typeof nav)[number]["id"];
export function Workspace({ mode = "sandbox" }: { mode?: "sandbox" | "account" }) {
  return (
    <WorkspaceProvider mode={mode}>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}
function WorkspaceShell() {
  const { state, project: p, selectProject, mode, status, undo, canUndo } = useWorkspace();
  const [page, setPage] = useState<Page>("overview");
  const pageMeta = nav.find((x) => x.id === page)!;
  return (
    <div className="ws-app ws-boldcase">
      <aside className="ws-sidebar">
        <a href="/" className="ws-brand">
          <img src="/branding/soblabs-logo.png" alt="Soblabs" />
          <span>
            FACTORY <i>•</i> BUSINESS WORKSPACE
          </span>
        </a>
        <div className="ws-workspace-label">YOUR WORKSPACE</div>
        <nav>
          {nav.map(({ id, label, icon: Icon }, n) => (
            <button
              className={page === id ? "active" : ""}
              key={id}
              aria-label={label}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              <small className="ws-nav-index" aria-hidden="true">
                {String(n + 1).padStart(2, "0")}
              </small>
              {id === "meetings" &&
                p.meetings.filter((m) => m.status === "Needs review").length > 0 && (
                  <b>{p.meetings.filter((m) => m.status === "Needs review").length}</b>
                )}
            </button>
          ))}
        </nav>
        <div className="ws-sidebar-bottom">
          <div className="ws-sidebar-status">
            <span className="ws-status-dot" />
            <span>
              {mode === "sandbox" ? "Design sandbox" : "Account workspace"}
              <small>{status}</small>
            </span>
          </div>
          {mode === "sandbox" ? (
            <a className="ws-button" href="/auth">
              <ShieldCheck size={15} />
              Account sign in
            </a>
          ) : (
            <button
              className="ws-button"
              onClick={() => void supabase.auth.signOut().then(() => location.assign("/auth"))}
            >
              Sign out
            </button>
          )}
          <p>
            {mode === "sandbox"
              ? "Local design data only. Use sample information until secure deployment."
              : "Private owner workspace · MFA required"}
          </p>
        </div>
      </aside>
      <main className="ws-main">
        <header className="ws-topbar">
          <div className="ws-breadcrumb">
            Workspace <span>/</span> <strong>{pageMeta.label}</strong>
          </div>
          <div className="ws-topbar-actions">
            <label className="ws-project-switch">
              <FolderKanban size={15} />
              <select
                aria-label="Current project"
                value={p.id}
                onChange={(e) => selectProject(e.target.value)}
              >
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <button
              className="ws-icon-button"
              aria-label="Undo last change"
              title="Undo last change"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 size={17} />
            </button>
            <div className="ws-avatar">S</div>
          </div>
        </header>
        <div className="ws-mode-banner">
          {mode === "sandbox" ? (
            <>
              <span className="ws-badge">DESIGN SANDBOX</span>Changes are saved in this browser.
              Login, cloud storage, and integrations are separate.
            </>
          ) : (
            <>
              <ShieldCheck size={14} />
              Signed-in workspace · owner-scoped cloud storage
            </>
          )}
        </div>
        <div className="ws-content">
          {page === "overview" ? (
            <Overview navigate={setPage} />
          ) : page === "projects" ? (
            <Projects key={p.id} navigate={setPage} />
          ) : page === "bom" ? (
            <Bom key={p.id} />
          ) : page === "designer" ? (
            <Designer key={p.id} />
          ) : page === "led" ? (
            <Led key={p.id} />
          ) : page === "projection" ? (
            <Projection key={p.id} />
          ) : page === "meetings" ? (
            <Meetings key={p.id} />
          ) : page === "crm" ? (
            <Crm />
          ) : (
            <Settings />
          )}
        </div>
        <footer className="ws-footer">
          <span>Soblabs Factory · {p.name}</span>
          <span>{status}</span>
        </footer>
      </main>
    </div>
  );
}
function Overview({ navigate }: { navigate: (p: Page) => void }) {
  const { project: p, updateProject } = useWorkspace();
  const t = totals(p),
    issues = reconcile(p);
  const [newTask, setNewTask] = useState("");
  return (
    <>
      <DashboardStart navigate={navigate} />
      <div className="ws-section-heading">
        <div>
          <h2>{p.name}</h2>
          <p>
            {p.customer || "Customer not assigned"} · Revision {p.revision}
          </p>
        </div>
        <span className="ws-badge mint">{p.stage}</span>
      </div>
      <div className="ws-metrics">
        <Metric
          label="Selected BOM items"
          value={String(p.items.filter((i) => i.scope === "Selected").length)}
        />
        <Metric
          label="System selling price"
          value={t.incomplete ? "Pricing incomplete" : formatMoney(t.sell, p.currency)}
        />
        <Metric
          label="Design checks"
          value={issues.length ? `${issues.length} to review` : "No quantity issues"}
        />
        <Metric label="Open follow-ups" value={String(p.tasks.filter((t) => !t.done).length)} />
      </div>
      <div className="ws-overview-grid">
        <div className="ws-card">
          <div className="ws-section-heading">
            <h3>Project follow-ups</h3>
            <span className="ws-badge">{p.tasks.length}</span>
          </div>
          {p.tasks.map((task) => (
            <div className="ws-task" key={task.id}>
              <button
                aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}
                className={`ws-task-check ${task.done ? "done" : ""}`}
                onClick={() =>
                  updateProject({
                    ...p,
                    tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
                  })
                }
              >
                {task.done && <CircleCheck size={17} />}
              </button>
              <span className={task.done ? "completed" : ""}>
                {task.title}
                <small>
                  {task.owner || "Unassigned"} · {task.due || "No due date"}
                  {task.sourceMeetingId ? " · Meeting action" : ""}
                </small>
              </span>
              <button
                className="ws-icon-button"
                aria-label="Delete follow-up"
                onClick={() =>
                  updateProject({ ...p, tasks: p.tasks.filter((t) => t.id !== task.id) })
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {!p.tasks.length && (
            <p className="ws-empty">No follow-ups yet. Add one or import meeting notes.</p>
          )}
          <form
            className="ws-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTask.trim()) return;
              updateProject({
                ...p,
                tasks: [
                  ...p.tasks,
                  {
                    id: uid(),
                    title: newTask.trim(),
                    owner: "",
                    due: "",
                    done: false,
                    sourceMeetingId: null,
                  },
                ],
              });
              setNewTask("");
            }}
          >
            <input
              aria-label="New follow-up"
              placeholder="Add a project follow-up…"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
            />
            <button className="ws-icon-button" aria-label="Add follow-up">
              <Plus size={18} />
            </button>
          </form>
        </div>
        <div className="ws-card">
          <div className="ws-section-heading">
            <h3>Design & BOM alignment</h3>
            <Workflow size={18} />
          </div>
          <p className="ws-muted">Spot omissions before they become installation surprises.</p>
          <div className="ws-overview-checks">
            {issues.slice(0, 4).map((issue, i) => (
              <p key={i}>
                <AlertTriangle size={15} />
                {issue}
              </p>
            ))}
            {!issues.length && (
              <p>
                <CircleCheck size={17} />
                Quantities and rack placement agree.
              </p>
            )}
          </div>
          <button className="ws-text-button" onClick={() => navigate("designer")}>
            Review system design <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
      <div className="ws-module-grid">
        {[
          {
            page: "led" as const,
            icon: Grid2X2,
            title: "Shape the display",
            description: "Size the wall and send cabinet quantities to the BOM.",
          },
          {
            page: "bom" as const,
            icon: ListChecks,
            title: "Build the complete system",
            description: "Add backend equipment or bring in your Excel workbook.",
          },
          {
            page: "meetings" as const,
            icon: FileText,
            title: "Keep the conversation",
            description: "Import PLAUD notes and review the next steps.",
          },
        ].map(({ page, icon: Icon, title, description }) => (
          <button className="ws-module-card" key={page} onClick={() => navigate(page)}>
            <Icon size={24} />
            <h3>{title}</h3>
            <p>{description}</p>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
    </>
  );
}
function Projects({ navigate }: { navigate: (p: Page) => void }) {
  const { state, setState, project, selectProject, updateProject } = useWorkspace();
  const [name, setName] = useState("");
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>Projects</h2>
          <p>Keep each installation’s design, costs, and conversations together.</p>
        </div>
      </div>
      <form
        className="ws-inline-form ws-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const p = blankProject(name.trim());
          setState({ ...state, projects: [...state.projects, p] });
          selectProject(p.id);
          setName("");
        }}
      >
        <input
          aria-label="New project name"
          placeholder="Name your next project…"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="ws-button primary">
          <Plus size={15} />
          Create project
        </button>
      </form>
      <div className="ws-project-grid">
        {state.projects.map((p) => (
          <button
            className={`ws-project-card ${p.id === project.id ? "selected" : ""}`}
            key={p.id}
            onClick={() => {
              selectProject(p.id);
              navigate("overview");
            }}
          >
            <div>
              <FolderKanban size={22} />
              <span className="ws-badge">{p.stage}</span>
            </div>
            <h3>{p.name}</h3>
            <p>{p.customer || "No customer assigned"}</p>
            <footer>
              {p.items.length} BOM items · {p.devices.length} drawing instances
              <ArrowUpRight size={16} />
            </footer>
          </button>
        ))}
      </div>
      <div className="ws-card ws-spaced">
        <h3>Current project settings</h3>
        <div className="ws-form-grid">
          <label>
            Project name
            <input
              value={project.name}
              onChange={(e) => updateProject({ ...project, name: e.target.value })}
            />
          </label>
          <label>
            CRM account
            <select
              value={project.accountId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                updateProject({
                  ...project,
                  accountId: id,
                  customer: state.accounts.find((a) => a.id === id)?.name ?? project.customer,
                });
              }}
            >
              <option value="">Not linked</option>
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Customer / Company
            <input
              disabled={!!project.accountId}
              value={project.customer}
              onChange={(e) => updateProject({ ...project, customer: e.target.value })}
            />
          </label>
          <label>
            Project stage
            <select
              value={project.stage}
              onChange={(e) =>
                updateProject({ ...project, stage: e.target.value as typeof project.stage })
              }
            >
              {["Discovery", "Design", "Proposal", "Procurement", "Installation", "Complete"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Output currency
            <select
              value={project.currency}
              onChange={(e) => {
                const currency = e.target.value as "CAD" | "USD";
                updateProject({
                  ...project,
                  currency,
                  items: project.items.map((i) => ({
                    ...i,
                    fx: i.currency === currency ? 1 : null,
                  })),
                });
              }}
            >
              <option>CAD</option>
              <option>USD</option>
            </select>
          </label>
          <label>
            Tax rate %
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              value={project.taxRate}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 0 && n <= 100) updateProject({ ...project, taxRate: n });
              }}
            />
          </label>
        </div>
      </div>
    </>
  );
}
function Settings() {
  const { state, setState, mode } = useWorkspace();
  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Backup exceeds 15 MB.");
      const next = stateSchema.parse(JSON.parse(await file.text()));
      if (confirm("Replace this workspace with the backup? Export your current workspace first.")) {
        setState(next);
        toast.success("Backup restored");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid backup");
    }
  }
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>Settings & integrations</h2>
          <p>Protect the workspace and connect the tools you already use.</p>
        </div>
      </div>
      <div className="ws-settings-grid">
        <div className="ws-card">
          <h3>
            <ShieldCheck size={20} />
            Security & storage
          </h3>
          <p>
            {mode === "sandbox"
              ? "This sandbox stores data in this browser. It is not a secure customer database."
              : "Account data is stored behind owner-specific database policies and an MFA session requirement."}
          </p>
          <p>
            Account mode requires Supabase configuration, the included database migrations, and
            authenticator-app MFA enrollment. No credentials are included in the repository.
          </p>
          <a className="ws-button" href="/auth">
            Account sign in
          </a>
        </div>
        <div className="ws-card">
          <h3>Workspace backup</h3>
          <p>
            Export all projects, drawing placements, BOM data, extracted notes, and contacts.
            Original PDFs are not included.
          </p>
          <div className="ws-actions">
            <button
              className="ws-button"
              onClick={() =>
                download("soblabs-workspace-backup.json", JSON.stringify(state, null, 2))
              }
            >
              <Download size={15} />
              Export backup
            </button>
            <label className="ws-button">
              <Upload size={15} />
              Restore backup
              <input
                hidden
                type="file"
                accept=".json"
                onChange={(e) => {
                  void restore(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        {[
          {
            name: "Microsoft 365",
            description:
              "Planned: email and calendar ingestion with source-linked CRM activity and a daily review digest.",
            needs: "Needs app registration and mailbox permissions for soblabs.ca.",
          },
          {
            name: "SharePoint / PLAUD",
            description:
              "Planned: detect new meeting PDFs in a designated library and queue their extracted updates for review.",
            needs: "Needs a selected site/library and Microsoft Graph access.",
          },
          {
            name: "TD SYNNEX",
            description:
              "Planned: distributor quote imports, purchasing, availability and lead-time tracking.",
            needs: "Live pricing access must be verified with the distributor.",
          },
        ].map((x) => (
          <div className="ws-card" key={x.name}>
            <div className="ws-section-heading">
              <h3>{x.name}</h3>
              <span className="ws-badge">Not connected</span>
            </div>
            <p>{x.description}</p>
            <p className="ws-footnote">{x.needs}</p>
          </div>
        ))}
      </div>
    </>
  );
}
