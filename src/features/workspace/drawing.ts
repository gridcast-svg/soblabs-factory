import type { Project } from "./model";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
export function drawingSvg(p: Project, view: "rack" | "schematic") {
  const minX = Math.min(0, ...p.devices.map((d) => d.x - 30)),
    minY = Math.min(0, ...p.devices.map((d) => d.y - 50));
  const width = view === "rack" ? 700 : Math.max(1200, ...p.devices.map((d) => d.x + 330)) - minX,
    height = view === "rack" ? 1050 : Math.max(700, ...p.devices.map((d) => d.y + 300)) - minY;
  let content = `<text x="24" y="30" fill="#173a4a" font-size="18">${esc(p.name)} · ${view} · revision ${p.revision}</text>`;
  if (view === "rack") {
    for (let u = 1; u <= 42; u++)
      content += `<rect x="90" y="${70 + (42 - u) * 22}" width="480" height="22" fill="white" stroke="#cbd5e1"/><text x="55" y="${86 + (42 - u) * 22}" font-size="11">${u}</text>`;
    for (const d of p.devices) {
      const i = p.items.find((i) => i.id === d.itemId);
      if (d.rackStart === null || !i?.rackU) continue;
      content += `<rect x="90" y="${70 + (43 - d.rackStart - i.rackU) * 22}" width="480" height="${i.rackU * 22}" fill="#d4f1f2" stroke="#173a4a"/><text x="105" y="${86 + (43 - d.rackStart - i.rackU) * 22}" font-size="12">${esc(d.label)} (${i.rackU}U)</text>`;
    }
  } else {
    content += `<g transform="translate(${-minX},${55 - minY})">`;
    for (const c of p.connections) {
      const a = p.devices.find((d) => d.id === c.source),
        b = p.devices.find((d) => d.id === c.target);
      if (!a || !b) continue;
      const ap =
          p.items.find((i) => i.id === a.itemId)?.ports.findIndex((x) => x.id === c.sourcePort) ??
          0,
        bp =
          p.items.find((i) => i.id === b.itemId)?.ports.findIndex((x) => x.id === c.targetPort) ??
          0;
      const x1 = a.x + 250,
        y1 = a.y + 75 + ap * 24,
        x2 = b.x,
        y2 = b.y + 75 + bp * 24,
        m = (x1 + x2) / 2;
      content += `<path d="M${x1} ${y1} H${m} V${y2} H${x2}" fill="none" stroke="#398694" stroke-width="2"/><text x="${m + 4}" y="${(y1 + y2) / 2 - 8}" font-size="10">${esc(c.label + " · " + c.cableType + (c.lengthM ? " · " + c.lengthM + "m" : ""))}</text>`;
    }
    for (const d of p.devices) {
      const i = p.items.find((i) => i.id === d.itemId);
      content += `<rect x="${d.x}" y="${d.y}" width="250" height="${Math.max(110, 75 + (i?.ports.length ?? 0) * 24)}" rx="8" fill="#eef7f8" stroke="#173a4a"/><text x="${d.x + 12}" y="${d.y + 24}" font-size="12">${esc(d.label)}</text>`;
      i?.ports.forEach((port, n) => {
        content += `<text x="${d.x + 12}" y="${d.y + 75 + n * 24}" font-size="10">${esc(port.direction + " · " + port.label + " · " + port.connector)}</text>`;
      });
    }
    content += "</g>";
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + 55}" width="${width}" height="${height + 55}" font-family="Arial,sans-serif"><rect width="100%" height="100%" fill="white"/>${content}</svg>`;
}
