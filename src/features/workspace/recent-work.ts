import type { Project, WorkspaceState, WorkSection } from "./model";

export const workSections: Record<WorkSection, string> = {
  projects: "Project details & follow-ups",
  bom: "Bill of materials",
  designer: "System design",
  led: "LED layout",
  projection: "Projection plan",
  meetings: "Meeting notes",
};
const fields: Record<WorkSection, (keyof Project)[]> = {
  projects: ["name", "customer", "stage", "tasks", "accountId"],
  bom: ["items", "currency", "taxRate", "revision"],
  designer: ["devices", "connections", "avDrafts", "avLibrary", "drawingSets"],
  led: ["led", "ledPlanner", "ledDesigns"],
  projection: ["projection", "projectionLibrary", "projectionDesigns"],
  meetings: ["meetings"],
};

/** Record actual changed sections, never page views or invented legacy edit dates. */
export function trackRecentWork(
  previous: WorkspaceState,
  next: WorkspaceState,
  editedAt = new Date().toISOString(),
): WorkspaceState {
  let entries = next.recentWork.filter((e) => next.projects.some((p) => p.id === e.projectId));
  for (const project of next.projects) {
    const before = previous.projects.find((p) => p.id === project.id);
    const sections = before
      ? (Object.keys(fields) as WorkSection[]).filter((section) =>
          fields[section].some(
            (key) => JSON.stringify(before[key]) !== JSON.stringify(project[key]),
          ),
        )
      : ["projects" as const];
    for (const section of sections) {
      entries = entries.filter((e) => e.projectId !== project.id || e.section !== section);
      entries.unshift({ projectId: project.id, section, editedAt });
    }
  }
  return { ...next, recentWork: entries.slice(0, 100) };
}
