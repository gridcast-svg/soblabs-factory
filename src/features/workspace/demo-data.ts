import { exampleState, stateSchema, type WorkspaceState } from "./model";
import { captureDrawingSet } from "./drawing-sets";
import { saveLedDesign } from "./led-planner";
import { saveProjectionDesign } from "./projection-planner";
import { projectionLibrarySchema } from "./projection-schema";

export const DEMO_PROJECT_IDS = [
  "factory-demo-lobby",
  "factory-demo-control",
  "factory-demo-gallery",
];

/** Add isolated fictional projects. Stable IDs make repeated loads harmless. */
export function addDemoProjects(
  state: WorkspaceState,
  now = new Date().toISOString(),
): WorkspaceState {
  const projects = [
    ["Demo · Lobby LED wall", "Fictional · Harbour Centre", "Design"],
    ["Demo · AV control rack", "Fictional · Studio North", "Proposal"],
    ["Demo · Gallery projection", "Fictional · Lakeside Gallery", "Discovery"],
  ] as const;
  const missing = projects.flatMap(([name, customer, stage], index) => {
    const id = DEMO_PROJECT_IDS[index]!;
    if (state.projects.some((p) => p.id === id)) return [];
    let p = exampleState().projects[0]!;
    p.id = id;
    p.name = name;
    p.customer = customer;
    p.stage = stage;
    p.items = p.items.map((item) => ({
      ...item,
      description: item.description.replace("Example", "Demo"),
      notes: "Fictional demonstration equipment. Specifications and pricing are unverified.",
    }));
    p.projectionLibrary = projectionLibrarySchema.parse({
      projectors: [
        {
          id: "demo-projector",
          brand: "Fictional",
          model: "Demo WUXGA projector",
          mount: "demo-mount",
          nativeWidth: 1920,
          nativeHeight: 1200,
          lumens: null,
          verified: false,
        },
      ],
      lenses: [
        {
          id: "demo-lens",
          name: "Demo zoom lens",
          mount: "demo-mount",
          throwRatioMin: 1.2,
          throwRatioMax: 2,
          verified: false,
        },
      ],
    });
    p.projection = { ...p.projection, projectorId: "demo-projector", lensId: "demo-lens" };
    p.tasks = [];
    for (let n = 0; n < 3; n++) {
      const at = new Date(Date.parse(now) - (index * 3 + n + 1) * 3600000).toISOString();
      const meetingId = `${id}-meeting-${n + 1}`;
      const topics = [
        "Discovery & site requirements",
        "System design review",
        "Installation planning",
      ];
      const actions = [
        "Confirm site dimensions",
        "Review cable paths and BOM quantities",
        "Confirm installation access",
      ];
      p.meetings.push({
        id: meetingId,
        title: `Demo · ${topics[n]}`,
        sourceName: "Fictional demo notes (not a PLAUD import)",
        importedAt: at,
        status: n === 0 ? "Needs review" : "Reviewed",
        text: `DEMO — fictional meeting notes\n\n${topics[n]}\nProject: ${name}\n\nDiscussion\nReview the display location, backend equipment, and installation dependencies. Product specifications and costs still need verification.\n\nAction items\n[ ] ${actions[n]}\n\nNo real meeting was recorded or imported.`,
      });
      p.tasks.push({
        id: `${id}-task-${n + 1}`,
        title: `Demo · ${actions[n]}`,
        owner: "Demo project lead",
        due: "",
        done: n === 2,
        sourceMeetingId: meetingId,
      });
      const drawing = captureDrawingSet(p, {
        title: `Demo · ${["Signal flow", "Rack layout", "Installation review"][n]}`,
        drawingNumber: `DEMO-${index + 1}0${n + 1}`,
        bomName: `${name} BOM`,
        notes: "Fictional sample drawing and BOM snapshot; not approved for installation.",
      });
      drawing.createdAt = at;
      p.drawingSets.push(drawing);
      p.led = { ...p.led, width: [6000, 4000, 8000][n]!, height: 3000 };
      p = saveLedDesign(p, `Demo · ${["Lobby standard", "Compact wall", "Wide presentation"][n]}`);
      p.ledDesigns.at(-1)!.createdAt = at;
      p.projection = { ...p.projection, widthM: [8, 6, 10][n]!, columns: n === 1 ? 1 : 2 };
      p = saveProjectionDesign(
        p,
        `Demo · ${["Two-projector blend", "Single projection", "Wide gallery blend"][n]}`,
      );
      p.projectionDesigns.at(-1)!.createdAt = at;
    }
    // Open each demo on its first saved configuration.
    p.led = structuredClone(p.ledDesigns[0]!.geometry);
    p.projection = structuredClone(p.projectionDesigns[0]!.config);
    return [p];
  });
  return stateSchema.parse({ ...state, projects: [...state.projects, ...missing] });
}
