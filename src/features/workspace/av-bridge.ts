import { avDocumentSchema, type AvDocument } from "./av-schema";
import { blankItem, type BomItem, type Project } from "./model";

function itemData(item: BomItem) {
  return {
    type: "device" as const,
    deviceId: "",
    manufacturer: item.manufacturer,
    model: item.partNumber || item.description,
    category: item.category,
    factoryItemId: item.id,
    ports: item.ports.map((port) => ({
      id: port.id,
      label: port.label,
      direction: port.direction === "output" ? ("output" as const) : ("input" as const),
      connectorType: port.connector,
      ...(port.direction === "bidirectional" ? { factoryBidirectional: true } : {}),
    })),
  };
}

export function projectToAv(project: Project): AvDocument {
  return {
    nodes: project.devices.map((device) => {
      const item = project.items.find((i) => i.id === device.itemId)!;
      return {
        id: device.id,
        position: { x: device.x, y: device.y },
        data: {
          ...itemData(item),
          deviceId: device.label,
          location: device.location ?? item.area,
          ...(device.avTemplateId ? { factoryTemplateId: device.avTemplateId } : {}),
        },
        ...(device.avGeometry ? { geometry: device.avGeometry } : {}),
      };
    }),
    edges: [
      ...project.connections.map((c) => ({
        id: c.id,
        source: c.source,
        sourcePort: c.sourcePort,
        target: c.target,
        targetPort: c.targetPort,
        ...(c.route ? { routingMode: c.route.mode, points: c.route.points } : {}),
        data: {
          type: "wire" as const,
          wireId: c.label,
          wireType: c.cableType,
          lengthM: c.lengthM,
          bomItemId: c.bomItemId,
        },
      })),
      ...project.avDrafts,
    ],
    library: project.avLibrary,
    bomLibrary: project.items
      .filter((i) => i.scope === "Selected" && i.drawingRequired)
      .map((item) => ({ libraryId: `bom:${item.id}`, template: itemData(item) })),
  };
}

export function applyAvDocument(project: Project, input: unknown): Project {
  const doc = avDocumentSchema.parse(input);
  for (const entries of [doc.nodes, doc.edges])
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
      throw new Error("The schematic contains duplicate record IDs.");
  const items = structuredClone(project.items);
  const specs = new Map<string, string>();
  const devices = doc.nodes.map((node) => {
    if (new Set(node.data.ports.map((port) => port.id)).size !== node.data.ports.length)
      throw new Error("Port IDs must be unique within each device.");
    const previous = project.devices.find((device) => device.id === node.id);
    if (previous && node.data.factoryItemId && previous.itemId !== node.data.factoryItemId)
      throw new Error("An existing drawing instance cannot change its BOM identity.");
    const itemId =
      previous?.itemId ?? node.data.factoryItemId ?? `av:${node.data.factoryTemplateId ?? node.id}`;
    let item = items.find((i) => i.id === itemId);
    if (!item) {
      if (node.data.factoryItemId) throw new Error("The selected BOM equipment no longer exists.");
      item = {
        ...blankItem(),
        id: itemId,
        description: node.data.model.trim() || "AV equipment",
        category: node.data.category || "Equipment",
        quantity: 0,
      };
      items.push(item);
    }
    item.manufacturer = node.data.manufacturer;
    item.partNumber = node.data.model === item.description ? item.partNumber : node.data.model;
    item.category = node.data.category || item.category;
    item.ports = node.data.ports.map((port) => ({
      id: port.id,
      label: port.label,
      direction:
        port.factoryBidirectional && port.direction === "input" ? "bidirectional" : port.direction,
      connector: port.connectorType ?? "",
    }));
    const spec = JSON.stringify([item.manufacturer, item.partNumber, item.category, item.ports]);
    if (specs.has(itemId) && specs.get(itemId) !== spec)
      throw new Error("Instances of the same BOM equipment must share their specifications.");
    specs.set(itemId, spec);
    return {
      id: node.id,
      itemId,
      label: node.data.deviceId,
      x: node.position.x,
      y: node.position.y,
      rackStart: previous?.rackStart ?? null,
      location: node.data.location ?? "",
      ...(node.geometry ? { avGeometry: node.geometry } : {}),
      ...(node.data.factoryTemplateId ? { avTemplateId: node.data.factoryTemplateId } : {}),
    };
  });
  for (const item of items) {
    if (!project.items.some((i) => i.id === item.id) || item.id.startsWith("av:"))
      item.quantity = Math.max(
        item.quantity,
        devices.filter((device) => device.itemId === item.id).length,
      );
  }
  const connections: Project["connections"] = [];
  const avDrafts: Project["avDrafts"] = [];
  for (const edge of doc.edges) {
    const hasEnd = (id: string, port: string | undefined) => {
      if (!id) return false;
      const device = devices.find((d) => d.id === id);
      if (!device || !items.find((i) => i.id === device.itemId)?.ports.some((p) => p.id === port))
        throw new Error("A cable refers to a missing device or port.");
      return true;
    };
    const from = hasEnd(edge.source, edge.sourcePort);
    const to = hasEnd(edge.target, edge.targetPort);
    if (edge.data.bomItemId && !items.some((i) => i.id === edge.data.bomItemId))
      throw new Error("A cable refers to a missing BOM item.");
    if (!from || !to) {
      if (!from && !to) throw new Error("A cable needs at least one connected end.");
      avDrafts.push(edge);
      continue;
    }
    if (edge.source === edge.target) throw new Error("Connect two different devices.");
    connections.push({
      id: edge.id,
      source: edge.source,
      sourcePort: edge.sourcePort!,
      target: edge.target,
      targetPort: edge.targetPort!,
      label: edge.data.wireId,
      cableType: edge.data.wireType ?? "Unspecified",
      lengthM: edge.data.lengthM ?? null,
      bomItemId: edge.data.bomItemId ?? null,
      ...(edge.points?.length
        ? { route: { mode: edge.routingMode ?? "auto", points: edge.points } }
        : {}),
    });
  }
  return {
    ...project,
    items,
    devices,
    connections,
    avDrafts,
    avLibrary:
      doc.library?.filter((entry) => !entry.libraryId.startsWith("bom:")) ?? project.avLibrary,
  };
}
