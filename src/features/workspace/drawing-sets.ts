import { blankProject, uid } from "./model";
import type { DrawingSet, Project } from "./model";

export function captureDrawingSet(
  project: Project,
  input: { title: string; drawingNumber: string; bomName: string; notes: string },
): DrawingSet {
  const title = input.title.trim();
  const drawingNumber = input.drawingNumber.trim().toUpperCase();
  const bomName = input.bomName.trim();
  if (
    !title ||
    title.length > 200 ||
    !drawingNumber ||
    drawingNumber.length > 80 ||
    !bomName ||
    bomName.length > 200
  )
    throw new Error("Enter a drawing title, drawing number, and BOM name within the shown limits.");
  if (input.notes.length > 4000)
    throw new Error("Revision notes must be 4,000 characters or fewer.");
  const previousBoms = project.drawingSets.filter(
    (d) => d.bomName.toLowerCase() === bomName.toLowerCase(),
  );
  const sameBom = previousBoms.find(
    (d) =>
      d.currency === project.currency &&
      d.taxRate === project.taxRate &&
      JSON.stringify(d.items) === JSON.stringify(project.items),
  );
  const latestBomRevision = Math.max(
    project.revision - 1,
    ...previousBoms.map((d) => d.bomRevision),
  );
  return {
    id: uid(),
    sourceProjectId: project.id,
    projectName: project.name,
    customer: project.customer,
    title,
    drawingNumber,
    drawingRevision:
      1 +
      Math.max(
        0,
        ...project.drawingSets
          .filter((d) => d.drawingNumber.toUpperCase() === drawingNumber)
          .map((d) => d.drawingRevision),
      ),
    bomName: sameBom?.bomName ?? bomName,
    bomSnapshotId: sameBom?.bomSnapshotId ?? uid(),
    bomRevision: sameBom?.bomRevision ?? latestBomRevision + 1,
    currency: project.currency,
    taxRate: project.taxRate,
    createdAt: new Date().toISOString(),
    notes: input.notes.trim(),
    items: structuredClone(project.items),
    devices: structuredClone(project.devices),
    connections: structuredClone(project.connections),
    avDrafts: structuredClone(project.avDrafts),
  };
}

export function drawingProject(drawing: DrawingSet): Project {
  return {
    ...blankProject(drawing.projectName),
    id: drawing.sourceProjectId,
    customer: drawing.customer,
    revision: drawing.bomRevision,
    currency: drawing.currency,
    taxRate: drawing.taxRate,
    items: drawing.items,
    devices: drawing.devices,
    connections: drawing.connections,
    avDrafts: drawing.avDrafts,
  };
}

export function cableSchedule(project: Pick<Project, "items" | "devices" | "connections">) {
  return project.connections.map((c) => {
    const source = project.devices.find((d) => d.id === c.source);
    const target = project.devices.find((d) => d.id === c.target);
    const sourcePort = project.items
      .find((i) => i.id === source?.itemId)
      ?.ports.find((p) => p.id === c.sourcePort);
    const targetPort = project.items
      .find((i) => i.id === target?.itemId)
      ?.ports.find((p) => p.id === c.targetPort);
    const cable = project.items.find((i) => i.id === c.bomItemId);
    return {
      id: c.label,
      from: source?.label ?? "Missing device",
      fromPort: sourcePort?.label ?? "Missing port",
      fromConnector: sourcePort?.connector ?? "",
      to: target?.label ?? "Missing device",
      toPort: targetPort?.label ?? "Missing port",
      toConnector: targetPort?.connector ?? "",
      type: c.cableType,
      length: c.lengthM,
      bomItemId: c.bomItemId ?? "",
      partNumber: cable?.partNumber ?? "",
      supplierSku: cable?.sku ?? "",
    };
  });
}

export function cableCsv(drawing: DrawingSet) {
  const cell = (v: string | number | null) => {
    let text = v === null ? "" : String(v);
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows: (string | number | null)[][] = [
    [
      "Drawing",
      "Drawing revision",
      "BOM",
      "BOM revision",
      "BOM snapshot ID",
      "Cable ID",
      "From",
      "From port",
      "From connector",
      "To",
      "To port",
      "To connector",
      "Type",
      "Length (m)",
      "BOM item ID",
      "Part number",
      "Supplier SKU",
    ],
  ];
  for (const c of cableSchedule(drawing))
    rows.push([
      drawing.drawingNumber,
      drawing.drawingRevision,
      drawing.bomName,
      drawing.bomRevision,
      drawing.bomSnapshotId,
      c.id,
      c.from,
      c.fromPort,
      c.fromConnector,
      c.to,
      c.toPort,
      c.toConnector,
      c.type,
      c.length,
      c.bomItemId,
      c.partNumber,
      c.supplierSku,
    ]);
  return "\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function drawingFilename(drawing: DrawingSet) {
  return `${drawing.drawingNumber}-R${drawing.drawingRevision}`.replace(/[^a-z0-9_.-]+/gi, "-");
}

export function nextCableLabel(connections: Project["connections"]) {
  const labels = new Set(connections.map((c) => c.label.trim().toUpperCase()));
  let n = 1;
  while (labels.has(`C-${String(n).padStart(3, "0")}`)) n++;
  return `C-${String(n).padStart(3, "0")}`;
}
