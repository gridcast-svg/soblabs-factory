import {
  ArrowUpRight,
  Clock3,
  FileText,
  FlaskConical,
  ListChecks,
  Plus,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./store";
import { addDemoProjects, DEMO_PROJECT_IDS } from "./demo-data";
import { workSections } from "./recent-work";
import type { WorkSection } from "./model";
import "./dashboard.css";

export function DashboardStart({ navigate }: { navigate: (page: WorkSection) => void }) {
  const { state, setState, selectProject, mode } = useWorkspace();
  const recent = state.recentWork
    .filter((entry) => state.projects.some((p) => p.id === entry.projectId))
    .sort((a, b) => b.editedAt.localeCompare(a.editedAt))
    .slice(0, 6);
  const demosLoaded = DEMO_PROJECT_IDS.every((id) => state.projects.some((p) => p.id === id));
  return (
    <section className="ws-dashboard-start" aria-label="Workspace dashboard">
      <div className="ws-dashboard-heading">
        <div>
          <h1>Workspace</h1>
          <p>Pick up where you left off, or start something new.</p>
        </div>
        <div className="ws-actions" aria-label="Quick actions">
          <button className="ws-button primary" onClick={() => navigate("projects")}>
            <Plus size={15} />
            New project
          </button>
          <button className="ws-button" onClick={() => navigate("bom")}>
            <ListChecks size={15} />
            Open BOM
          </button>
          <button className="ws-button" onClick={() => navigate("designer")}>
            <Workflow size={15} />
            Open system designer
          </button>
          <button className="ws-button" onClick={() => navigate("meetings")}>
            <FileText size={15} />
            Open meeting notes
          </button>
        </div>
      </div>
      <div className="ws-recent-work">
        <div className="ws-recent-heading">
          <h2>
            <Clock3 size={18} />
            Recent work
          </h2>
          <span>Across all projects</span>
        </div>
        {recent.length ? (
          <div className="ws-recent-grid">
            {recent.map((entry) => {
              const project = state.projects.find((p) => p.id === entry.projectId)!;
              return (
                <button
                  className="ws-recent-row"
                  key={`${entry.projectId}:${entry.section}`}
                  onClick={() => {
                    selectProject(project.id);
                    navigate(entry.section);
                  }}
                >
                  <div>
                    <strong>{workSections[entry.section]}</strong>
                    <span>{project.name}</span>
                  </div>
                  <time dateTime={entry.editedAt}>
                    {new Date(entry.editedAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  <ArrowUpRight size={17} />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="ws-recent-empty">
            Save a change in any project to pick up where you left off here.
          </p>
        )}
      </div>
      {mode === "sandbox" && (
        <div className="ws-demo-bar">
          <div>
            <FlaskConical size={16} />
            <span>
              Explore three demo projects, each with 3 BOM items, drawings, LED layouts, projection
              plans, and meeting notes. Fictional data; CRM stays unchanged.
            </span>
          </div>
          <button
            className="ws-button"
            disabled={demosLoaded}
            onClick={() => {
              try {
                const next = addDemoProjects(state);
                setState(next);
                selectProject(DEMO_PROJECT_IDS[0]!);
                toast.success("Demo projects added. Your existing projects and CRM are preserved.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to add demo projects");
              }
            }}
          >
            {demosLoaded ? "Demo projects added" : "Add demo projects"}
          </button>
        </div>
      )}
    </section>
  );
}
