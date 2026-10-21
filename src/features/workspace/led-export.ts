import { jsPDF } from "jspdf";
import type { Project, LedDesign } from "./model";
import { calculateLedPlan } from "./led-planner";
import { ledRoutingSvg } from "./led-drawing";

const clean = (s: string) =>
  s
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7e\n]/g, " ");
export async function ledReportPdf(project: Project, saved?: LedDesign): Promise<Blob> {
  await import("svg2pdf.js");
  const g = saved?.geometry ?? project.led,
    c = saved?.config ?? project.ledPlanner;
  const plan = calculateLedPlan(g, c),
    l = plan.layout;
  if (!l) throw new Error("Choose a valid LED layout before exporting.");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const title = saved?.title ?? "Current LED plan";
  const projectName = saved?.projectName ?? project.name;
  const revision = saved?.bomRevision ?? project.revision;
  pdf.setProperties({
    title: clean(`${projectName} - ${title}`),
    creator: "Soblabs Factory",
    subject: "LED layout and cable planning report",
  });
  function heading(section: string) {
    pdf.setTextColor(222, 88, 93);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(19);
    pdf.text("soblabs", 14, 18);
    pdf.setTextColor(30, 47, 65);
    pdf.setFontSize(11);
    pdf.text("FACTORY / LED PLANNER", 52, 18);
    pdf.setFontSize(13);
    pdf.text(clean(section), 14, 30);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      clean(
        `${projectName.slice(0, 120)} / ${title} / ${saved ? "LED BOM snapshot" : "Project BOM"} R${revision}${saved ? " / Saved " + saved.createdAt.slice(0, 10) : " / Current working design"}`,
      ),
      14,
      38,
      { maxWidth: 390 },
    );
    pdf.setFontSize(8);
    pdf.text(
      "Planning report - verify product specifications, electrical requirements, rigging and installed cable paths.",
      14,
      288,
    );
  }
  for (const [n, layer] of (["data", "power"] as const).entries()) {
    if (n) pdf.addPage("a3", "landscape");
    heading(
      layer === "data" ? "Display layout and data routing" : "Display layout and power routing",
    );
    const svg = new DOMParser().parseFromString(
      ledRoutingSvg(g, plan, layer, true),
      "image/svg+xml",
    ).documentElement;
    await pdf.svg(svg, { x: 14, y: 44, width: 340, height: 221 });
    pdf.setFontSize(9);
    pdf.text(
      [
        `${l.cabinets} cabinets / ${l.columns} columns x ${l.rows} rows`,
        `${l.widthMm} x ${l.heightMm} mm`,
        `${l.pixelWidth} x ${l.pixelHeight} pixels`,
        `Area: ${l.areaSqm.toFixed(2)} m2`,
        `Weight: ${l.weightKg === null ? "Not specified" : l.weightKg.toFixed(1) + " kg"}`,
        `Maximum: ${plan.electrical?.maximumW ?? "Not specified"} W`,
        `Supply: ${c.voltage} V`,
        `Usable per circuit: ${plan.electrical?.usableAmps ?? "Unknown"} A`,
        `Processors (minimum): ${plan.demand?.processorsNeeded ?? "Unknown"}`,
      ],
      355,
      60,
      { maxWidth: 50, lineHeightFactor: 1.7 },
    );
  }
  pdf.addPage("a3", "landscape");
  heading("Specifications, cable schedule and open design checks");
  let y = 50;
  function row(label: string, detail: string) {
    const lines = pdf.splitTextToSize(clean(`${label}: ${detail}`), 385) as string[];
    for (const line of lines) {
      if (y > 275) {
        pdf.addPage("a3", "landscape");
        heading("LED planning report - continued");
        y = 50;
      }
      pdf.setFontSize(9);
      pdf.text(line, 14, y);
      y += 5;
    }
    y += 2;
  }
  row("Cabinet", `${c.cabinetManufacturer} ${c.cabinetModel}`.trim() || "Model not specified");
  row(
    "Pixel pitch",
    `Target ${c.requestedPitchMm ?? "Exact pixel mode"}; actual ${(g.cabinetWidth / g.pixelWidth).toFixed(3)} x ${(g.cabinetHeight / g.pixelHeight).toFixed(3)} mm`,
  );
  row(
    "Rated brightness / refresh",
    `${c.brightnessNits ?? "Not specified"} nits / ${c.refreshHz ?? "Not specified"} Hz; manufacturer specifications, not inferred from pitch.`,
  );
  row("Specification source", c.specSource || "Not supplied");
  row("Processor", c.processorModel || "Model not specified");
  row(
    "Processor limits",
    `${c.pixelsPerPort ?? "Unknown"} pixels/port; ${c.dataPorts ?? "Unknown"} ports; ${c.processorPixels ?? "Unknown"} total pixels; canvas ${c.canvasWidth ?? "?"} x ${c.canvasHeight ?? "?"}`,
  );
  row(
    "Supply assumptions",
    `${c.voltage} V; ${c.breakerAmps} A breaker at 80%; ${c.connectorAmps} A connector limit. Current estimate assumes power factor 1; verify manufacturer's input current.`,
  );
  row(
    "Cable assumptions",
    `${c.sourceDistanceM} m rack-to-screen, ${c.trimHeightM} m floor-to-screen bottom, ${c.slackPercent}% allowance. Jumpers require lengths/connectors. Data transport limits require separate verification.`,
  );
  if (plan.rigging)
    row(
      "Rigging arithmetic",
      `${c.mount}; ${plan.rigging.totalKg} kg of cabinets; ${plan.rigging.perPointKg === null ? "No per-point load declared" : plan.rigging.perPointKg.toFixed(1) + " kg/point"}; excludes structure, cabling, dynamics and mounting hardware.`,
    );
  if (plan.viewing)
    row(
      "Viewing estimate",
      `Derived pitch ${plan.viewing.pitchMm.toFixed(3)} mm; trade minimum ${plan.viewing.minimumDistanceM.toFixed(1)} m; 20/20 acuity threshold ${plan.viewing.retinaDistanceM.toFixed(1)} m. Content and site conditions affect legibility.`,
    );
  for (const layer of ["data", "power"] as const) {
    const schedule = layer === "data" ? plan.dataSchedule : plan.powerSchedule;
    if (!schedule) {
      row(`${layer} cables`, "Not calculated - enter specifications or resolve routing checks.");
      continue;
    }
    row(
      `${layer} cables`,
      `${schedule.totalMains} mains, ${schedule.totalJumpers} cabinet jumpers`,
    );
    for (const run of schedule.runs)
      row(
        `${layer.toUpperCase()}-${String(run.cable).padStart(3, "0")}`,
        `${run.cabinets} cabinets; main estimate ${run.rawLengthM.toFixed(1)} m; stock length ${run.rawLengthM > 50 ? "CUSTOM (>50 m)" : run.mainLengthM + " m"}; ${run.jumpers} jumpers`,
      );
  }
  for (const issue of plan.issues) row("Open check", issue);
  row(
    "BOM association",
    saved
      ? `LED BOM snapshot ${saved.bomSnapshotId}, R${saved.bomRevision}, ${saved.items.length} item rows captured with this design. Restoring a layout does not overwrite the current BOM.`
      : "Current working design; save a named design after updating the BOM to retain its BOM snapshot.",
  );
  if (saved) {
    for (const item of saved.items.filter((i) => i.scope === "Selected")) {
      row(
        "Saved BOM material",
        `${item.quantity} ${item.unit} / ${item.description} / ${item.manufacturer} ${item.partNumber || item.sku}`,
      );
    }
  }
  return pdf.output("blob");
}

export function ledCableCsv(project: Project) {
  const plan = calculateLedPlan(project.led, project.ledPlanner);
  const rows: (string | number)[][] = [
    [
      "Layer",
      "Run",
      "Cabinets",
      "Estimated main (m)",
      "Stock length (m)",
      "Jumpers",
      "Cabinet path (row:column)",
    ],
  ];
  for (const layer of ["data", "power"] as const) {
    const schedule = layer === "data" ? plan.dataSchedule : plan.powerSchedule;
    const runs = layer === "data" ? plan.dataRuns : plan.powerRuns;
    for (const run of schedule?.runs ?? [])
      rows.push([
        layer,
        run.cable,
        run.cabinets,
        run.rawLengthM.toFixed(2),
        run.rawLengthM > 50 ? "CUSTOM" : run.mainLengthM,
        run.jumpers,
        runs
          .filter((r) => r.length)
          [run.cable - 1]!.map((p) => `${p.y + 1}:${p.x + 1}`)
          .join(" > "),
      ]);
  }
  return rows
    .map((row) => row.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}
