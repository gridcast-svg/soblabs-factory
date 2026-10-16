import type { DrawingSet, Project, Device, BomItem } from "./model";
import { signalColor } from "./signal-colors";

const esc = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

function geometry(device: Device, item: BomItem) {
  if (
    device.avGeometry &&
    device.avGeometry.ports.length === item.ports.length &&
    item.ports.every((port) => device.avGeometry!.ports.some((p) => p.id === port.id))
  )
    return device.avGeometry;
  const inputs = item.ports.filter((p) => p.direction !== "output");
  const outputs = item.ports.filter((p) => p.direction === "output");
  return {
    width: 280,
    height: 80 + Math.max(1, inputs.length, outputs.length) * 48,
    ports: item.ports.map((port) => ({
      id: port.id,
      x: port.direction === "output" ? 280 : 0,
      y: 104 + (port.direction === "output" ? outputs : inputs).indexOf(port) * 48,
      side: port.direction === "output" ? ("right" as const) : ("left" as const),
    })),
  };
}

export function avSchematicSvg(project: Project, saved?: DrawingSet) {
  const nodes = project.devices.flatMap((device) => {
    const item = project.items.find((i) => i.id === device.itemId);
    return item ? [{ device, item, box: geometry(device, item) }] : [];
  });
  const points = [
    ...project.connections.flatMap((c) => c.route?.points ?? []),
    ...project.avDrafts.flatMap((c) => c.points ?? []),
  ];
  const minX = Math.min(
    ...(nodes.length ? [] : [0]),
    ...nodes.map((n) => n.device.x - 80),
    ...points.map((p) => p.x - 80),
  );
  const minY = Math.min(
    ...(nodes.length ? [] : [0]),
    ...nodes.map((n) => n.device.y - 50),
    ...points.map((p) => p.y - 50),
  );
  const width =
    Math.max(
      minX + 1000,
      ...nodes.map((n) => n.device.x + n.box.width + 80),
      ...points.map((p) => p.x + 80),
    ) - minX;
  const height =
    Math.max(
      minY + 360,
      ...nodes.map((n) => n.device.y + n.box.height + 70),
      ...points.map((p) => p.y + 70),
    ) - minY;
  const anchor = (id: string, portId: string) => {
    const node = nodes.find((n) => n.device.id === id);
    const port = node?.box.ports.find((p) => p.id === portId);
    return node && port ? { x: node.device.x + port.x, y: node.device.y + port.y } : null;
  };
  let content = "";
  for (const wire of project.connections) {
    const from = anchor(wire.source, wire.sourcePort),
      to = anchor(wire.target, wire.targetPort);
    if (!from || !to) continue;
    const route = wire.route?.points.length
      ? wire.route.points
      : [from, { x: (from.x + to.x) / 2, y: from.y }, { x: (from.x + to.x) / 2, y: to.y }, to];
    content += `<polyline points="${route.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${signalColor(wire.cableType)}" stroke-width="2"${wire.bomItemId ? "" : ' stroke-dasharray="7 4"'}/>`;
    if (Math.hypot(to.x - from.x, to.y - from.y) < 140) {
      content += `<text x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 10}" text-anchor="middle" font-size="10" font-weight="bold" fill="#263b50">${esc(wire.label)}</text>`;
    } else {
      for (const [point, other] of [
        [route[0]!, route[1] ?? route[0]!],
        [route.at(-1)!, route.at(-2) ?? route.at(-1)!],
      ] as const) {
        const x = point.x + (other.x >= point.x ? 20 : -20);
        content += `<text x="${x}" y="${point.y - 10}" text-anchor="${other.x >= point.x ? "start" : "end"}" font-size="10" font-weight="bold" fill="#263b50" stroke="white" stroke-width="4" paint-order="stroke">${esc(wire.label)}</text>`;
      }
    }
  }
  for (const wire of project.avDrafts) {
    if (!wire.points?.length) continue;
    content += `<polyline points="${wire.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#b65252" stroke-width="2" stroke-dasharray="5 4"/><text x="${wire.points.at(-1)!.x + 10}" y="${wire.points.at(-1)!.y}" font-size="11" fill="#b65252">${esc(wire.data.wireId)} · UNFINISHED</text>`;
  }
  for (const [index, { device, item, box }] of nodes.entries()) {
    content += `<g transform="translate(${device.x},${device.y})"><title>${esc(item.description)}</title><rect width="${box.width}" height="${box.height}" rx="5" fill="white" stroke="#40566a" stroke-width="1.5"/><path d="M0 78 H${box.width}" stroke="#40566a"/><path d="M${box.width / 2} 78 V${box.height}" stroke="#d7e1e8"/><clipPath id="av-node-${index}"><rect x="8" y="4" width="${box.width - 16}" height="70"/></clipPath><g clip-path="url(#av-node-${index})" text-anchor="middle" fill="#22384b"><text x="${box.width / 2}" y="25" font-size="14" font-weight="bold">${esc(short(device.label, 34))}</text><text x="${box.width / 2}" y="44" font-size="11">${esc(short(item.manufacturer, 38))}</text><text x="${box.width / 2}" y="62" font-size="11">${esc(short(item.partNumber || item.description, 38))}</text></g>`;
    for (const port of box.ports) {
      const spec = item.ports.find((p) => p.id === port.id);
      if (!spec) continue;
      const right = port.side === "right";
      const x = right ? box.width - 12 : 12;
      content += `<path d="M${right ? box.width / 2 : 0} ${port.y + 22} H${right ? box.width : box.width / 2}" stroke="#e4eaef"/><rect x="${port.x - 4}" y="${port.y - 4}" width="8" height="8" fill="#e4f2f2" stroke="#40566a"/><g text-anchor="${right ? "end" : "start"}" fill="#243d51"><text x="${x}" y="${port.y - 2}" font-size="11">${esc(short(spec.label, 17))}</text><text x="${x}" y="${port.y + 13}" font-size="9" fill="#586b7d">${esc(short(spec.connector, 20))}</text></g>`;
    }
    content += "</g>";
  }
  const title = saved?.title ?? `${project.name} · system schematic`;
  const drawing = saved ? `${saved.drawingNumber} / R${saved.drawingRevision}` : "WORKING DESIGN";
  const bom = saved
    ? `${saved.bomName} / R${saved.bomRevision}`
    : `Working BOM R${project.revision}`;
  const total = height + 240;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${total}" viewBox="0 0 ${width} ${total}" font-family="Arial,sans-serif"><rect width="100%" height="100%" fill="white"/><rect x="12" y="12" width="${width - 24}" height="${total - 24}" fill="none" stroke="#22384b" stroke-width="2"/><text x="32" y="46" font-size="25" fill="#ec6c70">sob<tspan fill="#22384b">labs</tspan></text><text x="160" y="44" font-size="13" fill="#526a7d">FACTORY / SYSTEM ENGINEERING</text><text x="${width - 32}" y="44" text-anchor="end" font-size="14" fill="#22384b">${esc(drawing)}</text><path d="M12 64 H${width - 12}" stroke="#22384b"/><g transform="translate(${-minX},${85 - minY})">${content}</g><rect x="12" y="${height + 120}" width="${width - 24}" height="108" fill="#f1f6f8" stroke="#22384b"/><text x="32" y="${height + 143}" font-size="10" fill="#607285">SYSTEM SCHEMATIC</text><text x="32" y="${height + 168}" font-size="17" fill="#22384b">${esc(short(title, 100))}</text><text x="32" y="${height + 190}" font-size="11" fill="#40566a">${esc(short(bom, 120))}</text><text x="32" y="${height + 212}" font-size="10" fill="#607285">${esc(saved ? `BOM snapshot ${saved.bomSnapshotId} / ${saved.createdAt.slice(0, 10)} / ${saved.customer}` : "Unissued working design / Verify equipment, cable specifications and site requirements")}</text><text x="${width - 32}" y="${height + 143}" text-anchor="end" font-size="10" fill="#607285">DRAWING REFERENCE</text><text x="${width - 32}" y="${height + 168}" text-anchor="end" font-size="17" fill="#22384b">${esc(drawing)}</text><text x="${width - 32}" y="${height + 212}" text-anchor="end" font-size="10" fill="#607285">NTS / Verify before construction</text></svg>`;
}
