import type { DrawingSet, Project } from "./model";
export function signalColor(type: string) {
  if (/power|mains|iec|240v|120v/i.test(type)) return "#c44747";
  if (/fiber|fibre|optical/i.test(type)) return "#b56a19";
  if (/audio|xlr|dante/i.test(type)) return "#a347a1";
  if (/hdmi|displayport|sdi|video/i.test(type)) return "#536bce";
  if (/rj45|cat[5678]|ethernet|network/i.test(type)) return "#278078";
  return "#536779";
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
export function drawingSvg(p: Project, view: "rack" | "schematic", metadata?: DrawingSet) {
  const minX = Math.min(0, ...p.devices.map((d) => d.x - 30)),
    minY = Math.min(0, ...p.devices.map((d) => d.y - 50));
  const width = view === "rack" ? 700 : Math.max(1200, ...p.devices.map((d) => d.x + 330)) - minX,
    height =
      view === "rack"
        ? 1050
        : Math.max(
            700,
            ...p.devices.map(
              (d) =>
                d.y +
                Math.max(
                  110,
                  75 + (p.items.find((i) => i.id === d.itemId)?.ports.length ?? 0) * 24,
                ) +
                30,
            ),
          ) - minY;
  const reference = metadata
    ? `${metadata.drawingNumber} R${metadata.drawingRevision}`
    : `working BOM R${p.revision}`;
  let content = `<text x="24" y="30" fill="#173a4a" font-size="18">${esc(p.name)} · ${view} · ${esc(reference)}</text>`;
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
      content += `<path d="M${x1} ${y1} H${m} V${y2} H${x2}" fill="none" stroke="${signalColor(c.cableType)}" stroke-width="2"${c.bomItemId ? "" : ' stroke-dasharray="6 4"'}/><text x="${m + 4}" y="${(y1 + y2) / 2 - 8}" font-size="10">${esc(c.label + " · " + c.cableType + (c.lengthM ? " · " + c.lengthM + "m" : ""))}</text>`;
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
