import type { DrawingSet, Project } from "./model";
import { avSchematicSvg } from "./av-drawing";
export { signalColor } from "./signal-colors";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
export function drawingSvg(p: Project, view: "rack" | "schematic", metadata?: DrawingSet) {
  if (view === "schematic") return avSchematicSvg(p, metadata);
  const width = 700,
    height = 1050;
  const reference = metadata
    ? `${metadata.drawingNumber} R${metadata.drawingRevision}`
    : `working BOM R${p.revision}`;
  let content = `<text x="24" y="30" fill="#173a4a" font-size="18">${esc(p.name)} · ${view} · ${esc(reference)}</text>`;

  for (let u = 1; u <= 42; u++)
    content += `<rect x="90" y="${70 + (42 - u) * 22}" width="480" height="22" fill="white" stroke="#cbd5e1"/><text x="55" y="${86 + (42 - u) * 22}" font-size="11">${u}</text>`;
  for (const d of p.devices) {
    const i = p.items.find((i) => i.id === d.itemId);
    if (d.rackStart === null || !i?.rackU) continue;
    content += `<rect x="90" y="${70 + (43 - d.rackStart - i.rackU) * 22}" width="480" height="${i.rackU * 22}" fill="#d4f1f2" stroke="#173a4a"/><text x="105" y="${86 + (43 - d.rackStart - i.rackU) * 22}" font-size="12">${esc(d.label)} (${i.rackU}U)</text>`;
  }

  if (metadata) {
    const lines = [
      metadata.title,
      `${metadata.drawingNumber} · Drawing R${metadata.drawingRevision} · ${view}`,
      `${metadata.bomName} · BOM R${metadata.bomRevision}`,
      `Saved ${metadata.createdAt.slice(0, 10)} · ${metadata.customer}`,
      `BOM snapshot ${metadata.bomSnapshotId}`,
    ];
    content += `<rect x="20" y="${height + 20}" width="${width - 40}" height="115" fill="#eef7f8" stroke="#173a4a"/>`;
    lines.forEach((line, n) => {
      content += `<text x="32" y="${height + 40 + n * 20}" font-size="12">${esc(line)}</text>`;
    });
  }
  const fullHeight = height + (metadata ? 155 : 55);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${fullHeight}" width="${width}" height="${fullHeight}" font-family="Arial,sans-serif"><rect width="100%" height="100%" fill="white"/>${content}</svg>`;
}
