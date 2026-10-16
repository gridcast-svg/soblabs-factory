import { jsPDF } from "jspdf";
import { drawingSvg } from "./drawing";
import { cableSchedule, drawingProject } from "./drawing-sets";
import { reconcile } from "./model";
import type { DrawingSet } from "./model";

function clean(text: string) {
  return text.replace(/[\u2013\u2014]/g, "-").replace(/\t/g, " ");
}

function heading(pdf: jsPDF, drawing: DrawingSet, section: string) {
  const w = pdf.internal.pageSize.getWidth();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(clean(drawing.title), 12, 14, { maxWidth: w - 24 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    clean(`${drawing.drawingNumber} / Drawing R${drawing.drawingRevision} / ${section}`),
    12,
    24,
  );
  pdf.text(
    clean(`${drawing.bomName} / BOM R${drawing.bomRevision} / ${drawing.projectName}`),
    12,
    30,
    { maxWidth: w - 24 },
  );
  const checks = reconcile(drawingProject(drawing));
  pdf.setFontSize(8);
  pdf.text(
    checks.length
      ? `Draft - ${checks.length} unresolved design checks`
      : "Saved design - electrical and signal compatibility require technical verification",
    12,
    37,
  );
}

function footer(pdf: jsPDF, drawing: DrawingSet) {
  const h = pdf.internal.pageSize.getHeight();
  pdf.setFontSize(7);
  pdf.text(`BOM snapshot ${drawing.bomSnapshotId} / ${drawing.createdAt.slice(0, 10)}`, 12, h - 10);
}

export async function drawingPdf(drawing: DrawingSet): Promise<Blob> {
  await import("svg2pdf.js");
  const project = drawingProject(drawing);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  pdf.setProperties({
    title: `${drawing.drawingNumber} R${drawing.drawingRevision} - ${drawing.title}`,
    subject: `${drawing.bomName} R${drawing.bomRevision}`,
    creator: "Soblabs Factory",
  });
  for (const [n, view] of (["schematic", "rack"] as const).entries()) {
    if (n) pdf.addPage("a3", "landscape");
    heading(pdf, drawing, view === "schematic" ? "System schematic" : "Rack elevation");
    const svg = new DOMParser().parseFromString(
      drawingSvg(project, view, drawing),
      "image/svg+xml",
    ).documentElement;
    const width = Number(svg.getAttribute("width"));
    const height = Number(svg.getAttribute("height"));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      throw new Error("The drawing has invalid dimensions.");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const scale = Math.min((pageWidth - 24) / width, (pageHeight - 59) / height);
    await pdf.svg(svg, { x: 12, y: 43, width: width * scale, height: height * scale });
    footer(pdf, drawing);
  }
  function table(title: string, headers: string[], rows: string[][], widths: number[]) {
    function page() {
      pdf.addPage("a3", "landscape");
      heading(pdf, drawing, title);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      let x = 12;
      headers.forEach((text, i) => {
        pdf.text(text, x + 2, 47);
        x += widths[i]!;
      });
      pdf.setFont("helvetica", "normal");
      footer(pdf, drawing);
    }
    page();
    let y = 53;
    for (const row of rows.length ? rows : [headers.map((_, i) => (i === 0 ? "No records" : ""))]) {
      pdf.setFontSize(8);
      const lines = row.map(
        (text, i) => pdf.splitTextToSize(clean(text), widths[i]! - 4) as string[],
      );
      const rowHeight = Math.max(1, ...lines.map((line) => line.length)) * 3.7 + 5;
      if (rowHeight > 210)
        throw new Error(
          "A drawing label is too long for the report. Shorten it and save a new revision.",
        );
      if (y + rowHeight > 275) {
        page();
        y = 53;
      }
      let x = 12;
      lines.forEach((line, i) => {
        pdf.text(line, x + 2, y);
        x += widths[i]!;
      });
      pdf.setDrawColor(210);
      pdf.line(12, y + rowHeight - 3, 408, y + rowHeight - 3);
      y += rowHeight;
    }
  }
  table(
    "Cable schedule",
    ["Cable", "From / port", "To / port", "Signal / cable", "Length", "BOM part / SKU"],
    cableSchedule(drawing).map((c) => [
      c.id,
      `${c.from}\n${c.fromPort} / ${c.fromConnector}`,
      `${c.to}\n${c.toPort} / ${c.toConnector}`,
      c.type,
      c.length === null ? "Not specified" : `${c.length} m`,
      c.partNumber || c.supplierSku || (c.bomItemId ? "Linked - part not specified" : "Not linked"),
    ]),
    [25, 95, 95, 65, 30, 86],
  );
  table(
    "Device schedule - drawing tags to BOM equipment",
    ["Device / tag", "BOM equipment", "Manufacturer", "Part number / SKU", "Rack", "Area"],
    drawing.devices.map((device) => {
      const item = drawing.items.find((i) => i.id === device.itemId);
      return [
        device.label,
        item?.description ?? "Missing BOM item",
        item?.manufacturer ?? "",
        item?.partNumber || item?.sku || "Not specified",
        device.rackStart === null ? "Not racked" : `U${device.rackStart} / ${item?.rackU ?? 0}U`,
        item?.area ?? "",
      ];
    }),
    [55, 115, 60, 85, 35, 46],
  );
  table(
    "Linked BOM - equipment and materials (no pricing)",
    ["Area", "Equipment / material", "Manufacturer", "Part number / SKU", "Quantity"],
    drawing.items
      .filter((i) => i.scope === "Selected")
      .map((i) => [
        i.area,
        i.description,
        i.manufacturer,
        i.partNumber || i.sku,
        `${i.quantity} ${i.unit}`,
      ]),
    [50, 145, 65, 100, 36],
  );
  const issues = reconcile(project);
  table(
    "Revision notes and design checks",
    ["Type", "Detail"],
    [
      ["Revision notes", drawing.notes || "No notes supplied"],
      ...issues.map((issue) => ["Open check", issue]),
      [
        "Verification",
        "Quantity, port mapping, cable length and rack checks are advisory. Verify electrical, signal and site requirements before construction.",
      ],
    ],
    [50, 346],
  );
  return pdf.output("blob");
}

export function cableLabelsPdf(drawing: DrawingSet): Blob {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const cables = cableSchedule(drawing);
  if (!cables.length) throw new Error("This saved revision has no cables to label.");
  const labels = cables.flatMap((c) => [
    { cable: c, end: "A", near: `${c.from} / ${c.fromPort}`, far: `${c.to} / ${c.toPort}` },
    { cable: c, end: "B", near: `${c.to} / ${c.toPort}`, far: `${c.from} / ${c.fromPort}` },
  ]);
  labels.forEach((label, index) => {
    const slot = index % 16;
    if (!slot) {
      if (index) pdf.addPage();
      pdf.setFontSize(11);
      pdf.text(
        clean(`${drawing.drawingNumber} R${drawing.drawingRevision} - cable ends A + B`),
        12,
        13,
      );
      pdf.setFontSize(8);
      pdf.text(clean(`${drawing.bomName} R${drawing.bomRevision}`), 12, 20, { maxWidth: 186 });
      pdf.text(
        "Generic A4 grid: 90 x 28 mm labels. Print at 100%; verify paper and printer margins.",
        12,
        27,
      );
      footer(pdf, drawing);
    }
    const x = 12 + (slot % 2) * 96;
    const y = 35 + Math.floor(slot / 2) * 30;
    pdf.setDrawColor(170);
    pdf.rect(x, y, 90, 28);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    const idLines = pdf.splitTextToSize(
      clean(`${label.cable.id || "Unlabelled"} / END ${label.end}`),
      86,
    ) as string[];
    if (idLines.length > 1) throw new Error("Shorten the cable ID before printing labels.");
    pdf.text(idLines, x + 2, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    const detail = pdf.splitTextToSize(
      clean(
        `${label.near}\nTo: ${label.far}\n${label.cable.type}${label.cable.length === null ? "" : ` / ${label.cable.length}m`}`,
      ),
      86,
    ) as string[];
    if (detail.length > 4)
      throw new Error(
        "Shorten the device or port names before printing labels, or use the CSV schedule in your label software.",
      );
    pdf.text(detail, x + 2, y + 11);
  });
  return pdf.output("blob");
}
