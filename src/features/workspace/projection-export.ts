import { jsPDF } from "jspdf";
import type { Project, ProjectionDesign } from "./model";
import { calculateProjection } from "./projection-planner";
import { projectionSvg } from "./projection-drawing";

const clean = (s: string) =>
  s
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7e\n]/g, " ");
export async function projectionPdf(p: Project, saved?: ProjectionDesign): Promise<Blob> {
  await import("svg2pdf.js");
  const c = saved?.config ?? p.projection,
    library = saved?.library ?? p.projectionLibrary;
  const plan = calculateProjection(c, library),
    s = plan.solution;
  if (!s) throw new Error("Choose a calculable projection layout before exporting.");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const name = saved?.projectName ?? p.name,
    title = saved?.title ?? "Current projection plan";
  pdf.setProperties({
    title: clean(`${name} - ${title}`),
    creator: "Soblabs Factory",
    subject: "Projection layout and optical schedule",
  });
  function heading(section: string) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(19);
    pdf.setTextColor(222, 88, 93);
    pdf.text("soblabs", 14, 18);
    pdf.setFontSize(11);
    pdf.setTextColor(30, 47, 65);
    pdf.text("FACTORY / PROJECTION PLANNER", 52, 18);
    pdf.setFontSize(13);
    pdf.text(clean(section), 14, 30);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      clean(
        `${name.slice(0, 120)} / ${title} / ${saved ? "Projection BOM snapshot R" + saved.bomRevision : "Working design"}`,
      ),
      14,
      38,
      { maxWidth: 390 },
    );
    pdf.setFontSize(8);
    pdf.text(
      "Geometric planning report. Verify manufacturer specifications, lens compatibility, shift envelope and site installation.",
      14,
      288,
    );
  }
  for (const [n, view] of (["elevation", "plan"] as const).entries()) {
    if (n) pdf.addPage("a3", "landscape");
    heading(
      view === "elevation" ? "Projector array and blended canvas" : "Plan view and throw geometry",
    );
    const svg = new DOMParser().parseFromString(
      projectionSvg(c, plan, view, true),
      "image/svg+xml",
    ).documentElement;
    await pdf.svg(svg, { x: 14, y: 44, width: 340, height: 221 });
    pdf.setFontSize(9);
    pdf.text(
      clean(
        [
          `${c.columns * c.rows} projectors`,
          `${c.widthM} x ${c.heightM} m screen`,
          `Canvas ${plan.raster!.canvasWidth} x ${plan.raster!.canvasHeight} px`,
          `H blend ${(s.hOverlap * 100).toFixed(1)}% / ${s.pixels.hBlendPixels.toFixed(1)} px`,
          `V blend ${(s.vOverlap * 100).toFixed(1)}% / ${s.pixels.vBlendPixels.toFixed(1)} px`,
          `Duplicated pixels ${(s.pixels.overlapEfficiencyLoss * 100).toFixed(1)}%`,
          `Luminance ${plan.luminanceNits === null ? "Unknown" : plan.luminanceNits.toFixed(1) + " nits"}`,
          `Projector ${plan.projector!.verified ? "source checked" : "UNVERIFIED"}`,
          `Lens ${plan.lens?.verified ? "source checked" : "UNVERIFIED / MISSING"}`,
        ].join("\n"),
      ),
      355,
      60,
      { maxWidth: 50, lineHeightFactor: 1.7 },
    );
  }
  pdf.addPage("a3", "landscape");
  heading("Equipment, optics and installation schedule");
  let y = 50;
  const row = (label: string, value: string) => {
    const lines = pdf.splitTextToSize(clean(`${label}: ${value}`), 386) as string[];
    for (const line of lines) {
      if (y > 275) {
        pdf.addPage("a3", "landscape");
        heading("Projection schedule - continued");
        y = 50;
      }
      pdf.setFontSize(9);
      pdf.text(line, 14, y);
      y += 5;
    }
    y += 2;
  };
  row(
    "Projector",
    `${plan.projector!.brand} ${plan.projector!.model}; ${plan.projector!.nativeWidth} x ${plan.projector!.nativeHeight} px; ${plan.projector!.lumens ?? "Unknown"} lumens. ${plan.projector!.verified ? "Source checked" : "UNVERIFIED"}`,
  );
  if (plan.projector!.resolutionNote)
    row(
      "Panel / displayed resolution",
      plan.projector!.resolutionNote! +
        ` Planning raster: ${c.rasterMode}; ${plan.nativeProjector!.nativeWidth} x ${plan.nativeProjector!.nativeHeight} px.`,
    );
  if (c.room)
    row(
      "Room assumption",
      `${c.room.widthM} x ${c.room.depthM} x ${c.room.heightM} m (width x depth x height); centred front-wall screen and on-axis projection.`,
    );
  row("Projector source", plan.projector!.source || "Not supplied");
  row(
    "Lens",
    plan.lens
      ? `${plan.lens.name}; ${plan.lens.throwRatioMin}-${plan.lens.throwRatioMax}:1; ${plan.lens.verified ? "Source checked" : "UNVERIFIED"}`
      : "Not selected / no compatible lens",
  );
  row("Lens source", plan.lens?.source || "Not supplied");
  row(
    "Light estimate",
    "Nominal single-image luminance after removing overlap double-counting. Assumes rated lumens, declared screen gain, square pixels, no optical/ageing/ambient losses; curved incidence and masking can reduce it further.",
  );
  row(
    "Distance ranges",
    "Per-position lens zoom distances at the current image geometry; curved/common-point results are local reference-plane estimates. Changing the rig distance requires recalculation.",
  );
  for (const position of plan.placements)
    row(
      position.tag,
      `TR ${position.requiredThrowRatio.toFixed(3)}:1; perpendicular throw ${position.throwDistance.toFixed(3)} m; horizontal slant ${position.slantDistance.toFixed(3)} m; shift H ${position.hShiftPct.toFixed(1)}%, V ${position.vShiftPct.toFixed(1)}%; lens distance ${position.distanceMin?.toFixed(2) ?? "?"}-${position.distanceMax?.toFixed(2) ?? "?"} m; blend edges ${position.edges}`,
    );
  for (const diagnostic of plan.diagnostics)
    row(diagnostic.severity.toUpperCase(), diagnostic.message);
  row(
    "Resolume preset",
    "Geometry only: virtual outputs and identity warps. Configure physical outputs, per-edge soft blending and curved-screen warps in Arena. Format targets Arena 7.27 and has not been round-trip tested in a running Arena here.",
  );
  if (saved) {
    row(
      "BOM association",
      `Snapshot ${saved.bomSnapshotId}, R${saved.bomRevision}, saved ${saved.createdAt}.`,
    );
    for (const item of saved.items.filter((i) => i.scope === "Selected"))
      row(
        "Saved BOM material",
        `${item.quantity} ${item.unit} / ${item.description} / ${item.manufacturer} ${item.partNumber || item.sku}`,
      );
  } else
    row(
      "BOM association",
      "Working design. Save after updating the BOM to capture those quantities.",
    );
  return pdf.output("blob");
}
export function projectionScheduleCsv(p: Project) {
  const plan = calculateProjection(p.projection, p.projectionLibrary);
  const rows: (string | number)[][] = [
    [
      "Projector",
      "Row",
      "Column",
      "Throw ratio",
      "Perpendicular throw (m)",
      "Horizontal slant (m)",
      "Horizontal shift (%)",
      "Vertical shift (%)",
      "Blend edges",
    ],
  ];
  for (const x of plan.placements)
    rows.push([
      x.tag,
      x.row + 1,
      x.column + 1,
      x.requiredThrowRatio.toFixed(4),
      x.throwDistance.toFixed(3),
      x.slantDistance.toFixed(3),
      x.hShiftPct.toFixed(2),
      x.vShiftPct.toFixed(2),
      x.edges,
    ]);
  return rows
    .map((row) => row.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}
