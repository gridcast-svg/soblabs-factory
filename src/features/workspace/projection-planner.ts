import { solve } from "@/vendor/blend-calc/lib/geometry";
import { sliceLayout, exportResolumeXml } from "@/vendor/blend-calc/lib/resolume";
import type {
  Diagnostic,
  Lens,
  Projector as NativeProjector,
  Solution,
  ScreenSurface,
  ArrayConfig,
} from "@/vendor/blend-calc/types";
import {
  projectionLibrarySchema,
  type ProjectionConfig,
  type ProjectionLibrary,
  type ProjectionLens,
} from "./projection-schema";
import { blankItem, uid, type Project, type BomItem, type ProjectionDesign } from "./model";

const nativeLens = (l: ProjectionLens): Lens => ({
  id: l.id,
  name: l.name,
  throwRatioMin: l.throwRatioMin,
  throwRatioMax: l.throwRatioMax,
  ...(l.hShiftPct === null ? {} : { hShiftPct: l.hShiftPct }),
  ...(l.vShiftPct === null ? {} : { vShiftPct: l.vShiftPct }),
});

export function calculateProjection(c: ProjectionConfig, library: ProjectionLibrary) {
  const projector = library.projectors.find((p) => p.id === c.projectorId) ?? null;
  let lens = library.lenses.find((l) => l.id === c.lensId) ?? null;
  const diagnostics: Diagnostic[] = [];
  const add = (code: string, message: string, severity: Diagnostic["severity"] = "error") =>
    diagnostics.push({ code, message, severity });
  let solution: Solution | null = null;
  let nativeProjector: NativeProjector | null = null;
  let raster: ReturnType<typeof sliceLayout> | null = null;
  const placements: {
    tag: string;
    row: number;
    column: number;
    vShiftPct: number;
    hShiftPct: number;
    requiredThrowRatio: number;
    throwDistance: number;
    slantDistance: number;
    distanceMin: number | null;
    distanceMax: number | null;
    edges: string;
  }[] = [];
  let luminanceNits: number | null = null;
  const result = () => ({
    solution,
    projector,
    lens,
    nativeProjector,
    raster,
    diagnostics,
    placements,
    luminanceNits,
    canApplyBom:
      !!solution &&
      !!lens &&
      !!projector?.verified &&
      lens.verified &&
      !diagnostics.some((d) => d.severity === "error"),
    canExportArena:
      !!solution &&
      !!raster &&
      !!nativeProjector &&
      !diagnostics.some((d) => d.severity === "error"),
  });
  if (c.room) {
    if (c.widthM > c.room.widthM || c.heightM > c.room.heightM)
      add("screen-outside-room", "The screen exceeds the entered room width or height.");
    if (c.throwDistanceM > c.room.depthM)
      add("throw-outside-room", "The nominal throw exceeds the entered room depth.");
  }
  if (!projector) {
    add(
      "no-projector",
      "Add and select a projector profile with its native resolution to calculate.",
    );
    return result();
  }
  if (c.kind === "cylindrical" && c.widthM / c.radiusM > 2 * Math.PI + 1e-9) {
    add("wrap-over", "The screen arc exceeds a full circle. Reduce arc length or increase radius.");
    return result();
  }
  if (lens && lens.mount !== projector.mount) {
    add("mount-mismatch", "The selected lens belongs to a different mount family.");
    return result();
  }
  const screen: ScreenSurface = {
    geometry:
      c.kind === "flat"
        ? { kind: "flat", width: c.widthM, height: c.heightM }
        : { kind: "cylindrical", width: c.widthM, height: c.heightM, radius: c.radiusM },
    gain: c.gain,
  };
  const array: ArrayConfig = {
    columns: c.columns,
    rows: c.rows,
    fitMode: c.fitMode,
    hOverlap: c.hOverlap,
    vOverlap: c.vOverlap,
    placement: c.placement,
    throwDistance: c.throwDistanceM,
  };
  // Zero lumens is only a sentinel to let geometry run when rated output is unknown.
  // Upstream luminance is replaced below, and unknown output is never displayed as zero.
  nativeProjector = {
    id: projector.id,
    brand: projector.brand,
    model: projector.model,
    nativeWidth:
      c.rasterMode === "display"
        ? (projector.displayWidth ?? projector.nativeWidth)
        : projector.nativeWidth,
    nativeHeight:
      c.rasterMode === "display"
        ? (projector.displayHeight ?? projector.nativeHeight)
        : projector.nativeHeight,
    lumens: projector.lumens ?? 0,
    lensSeriesId: projector.mount,
  };
  const base = solve(screen, array, nativeProjector, null, []);
  const numeric = [
    base.tileWidth,
    base.tileHeight,
    base.hOverlap,
    base.vOverlap,
    base.curveHeightRatio,
    ...base.columns.flatMap((p) => [
      p.flatImageWidth,
      p.requiredThrowRatio,
      p.hShiftPct,
      p.throwDistance,
      p.slantDistance,
    ]),
  ];
  if (
    !base.columns.length ||
    numeric.some((n) => !Number.isFinite(n)) ||
    base.tileWidth <= 0 ||
    base.tileHeight <= 0 ||
    base.hOverlap < 0 ||
    base.hOverlap > 0.5 ||
    base.vOverlap < 0 ||
    base.vOverlap > 0.5 ||
    base.columns.some(
      (p) => p.flatImageWidth <= 0 || p.requiredThrowRatio <= 0 || p.throwDistance <= 0,
    )
  ) {
    diagnostics.push(...base.diagnostics);
    add(
      "invalid-optics",
      "This array does not produce finite, supported optical geometry. Adjust the screen, overlap, throw or placement.",
    );
    return result();
  }
  if (c.kind === "cylindrical") {
    const theta = base.tileWidth / c.radiusM;
    const unsafe =
      theta >= Math.PI ||
      (c.placement === "common-point" &&
        base.columns.some((_, column) => {
          const phi =
            ((column - (c.columns - 1) / 2) * base.tileWidth * (1 - base.hOverlap)) / c.radiusM;
          return [phi - theta / 2, phi + theta / 2].some(
            (angle) => c.radiusM * Math.cos(angle) - (c.radiusM - c.throwDistanceM) <= 1e-9,
          );
        }));
    if (unsafe) {
      add(
        "invalid-arc",
        "A tile reaches behind its optical reference plane or spans 180 degrees. Use more columns or change placement/throw.",
      );
      return result();
    }
  }
  const aspect = nativeProjector.nativeWidth / nativeProjector.nativeHeight;
  for (let row = 0; row < c.rows; row++)
    for (const col of base.columns) {
      const offset = (row - (c.rows - 1) / 2) * base.tileHeight * (1 - base.vOverlap);
      placements.push({
        tag: `PRJ-R${row + 1}C${col.column + 1}`,
        row,
        column: col.column,
        vShiftPct:
          c.placement === "common-point" ? (offset / (col.flatImageWidth / aspect)) * 100 : 0,
        hShiftPct: col.hShiftPct,
        requiredThrowRatio: col.requiredThrowRatio,
        throwDistance: col.throwDistance,
        slantDistance: col.slantDistance,
        distanceMin: null,
        distanceMax: null,
        edges:
          [
            col.column > 0 ? "L" : "",
            col.column < c.columns - 1 ? "R" : "",
            row > 0 ? "T" : "",
            row < c.rows - 1 ? "B" : "",
          ]
            .filter(Boolean)
            .join(" ") || "None",
      });
    }
  const maxH = Math.max(...placements.map((p) => Math.abs(p.hShiftPct)));
  const maxV = Math.max(...placements.map((p) => Math.abs(p.vShiftPct)));
  const minTR = Math.min(...placements.map((p) => p.requiredThrowRatio)),
    maxTR = Math.max(...placements.map((p) => p.requiredThrowRatio));
  if (!lens)
    lens =
      library.lenses
        .filter(
          (l) =>
            l.mount === projector.mount &&
            l.throwRatioMin <= minTR + 1e-9 &&
            l.throwRatioMax >= maxTR - 1e-9 &&
            (l.hShiftPct === null || l.hShiftPct + 1e-9 >= maxH) &&
            (l.vShiftPct === null || l.vShiftPct + 1e-9 >= maxV),
        )
        .sort((a, b) => Number(b.verified) - Number(a.verified))[0] ?? null;
  solution = solve(screen, array, nativeProjector, lens ? nativeLens(lens) : null, []);
  diagnostics.push(
    ...solution.diagnostics.filter((d) => d.code !== "dim" && d.code !== "unverified-specs"),
  );
  if (!lens)
    add(
      "no-lens",
      "No compatible lens covers the required throw and declared shift limits. Add a lens or adjust the design.",
    );
  else {
    for (const p of placements) {
      const col = solution.columns[p.column]!;
      p.distanceMin = lens.throwRatioMin * col.flatImageWidth;
      p.distanceMax = lens.throwRatioMax * col.flatImageWidth;
    }
    if (maxV > 1e-6 && lens.vShiftPct !== null && maxV > lens.vShiftPct + 1e-9)
      add(
        "vertical-shift",
        `This placement requires ${maxV.toFixed(1)}% vertical lens shift; the lens declares ${lens.vShiftPct}%.`,
      );
    if ((maxH > 1e-6 && lens.hShiftPct === null) || (maxV > 1e-6 && lens.vShiftPct === null))
      add(
        "unknown-shift",
        "Required lens shift has an unknown limit. Verify the exact lens shift envelope before applying the BOM.",
      );
    if (maxH > 1e-6 && maxV > 1e-6)
      add(
        "coupled-shift",
        "Both shift axes are used. Independent limits do not prove the manufacturer's coupled lens-shift envelope; verify it separately.",
        "warning",
      );
    if (!lens.verified)
      add(
        "unverified-lens",
        "Lens specifications are unverified. Check its source and mark the profile verified before updating the BOM.",
        "warning",
      );
  }
  if (!projector.verified)
    add(
      "unverified-projector",
      "Projector specifications are unverified. Check its source and mark the profile verified before updating the BOM.",
      "warning",
    );
  if (solution.widthSpill < -1e-6 || solution.heightSpill < -1e-6)
    add(
      "uncovered-screen",
      "The array leaves part of the requested screen uncovered. Adjust the screen size, array or fit mode.",
    );
  if (projector.lumens !== null) {
    // A compensated blend does not gain brightness from duplicated flux in overlaps.
    // This is the dimmest ideal flat-image estimate, before real optical losses.
    const imageArea = Math.max(...solution.columns.map((col) => col.flatImageWidth ** 2 / aspect));
    luminanceNits = (projector.lumens * c.gain) / (Math.PI * imageArea);
  } else
    add("unknown-output", "Rated light output is unknown; luminance is not estimated.", "warning");
  solution.luminanceNits = luminanceNits ?? 0;
  solution.luminanceFootLamberts = luminanceNits === null ? 0 : luminanceNits / 3.4262591;
  raster = sliceLayout(solution, nativeProjector, c.columns, c.rows, "Projection");
  solution.ok = !diagnostics.some((d) => d.severity === "error");
  return result();
}
export type ProjectionPlan = ReturnType<typeof calculateProjection>;

export function projectionBomLines(p: Project): BomItem[] {
  const plan = calculateProjection(p.projection, p.projectionLibrary);
  if (!plan.projector || !plan.lens || !plan.solution) return [];
  const count = p.projection.columns * p.projection.rows;
  const line = (
    role: string,
    description: string,
    quantity: number,
    manufacturer: string,
    partNumber: string,
    category: string,
  ): BomItem => {
    const id = `projection-generated-${p.id}-${role}`,
      old = p.items.find((i) => i.id === id);
    const modelChanged =
      old &&
      (old.manufacturer !== manufacturer ||
        old.partNumber !== partNumber ||
        (role === "screen" && old.description !== description));
    return {
      ...(old ?? blankItem()),
      id,
      description,
      quantity,
      manufacturer,
      partNumber,
      category,
      area: old?.area ?? "Projection",
      scope: "Selected",
      currency: old?.currency ?? p.currency,
      ...(modelChanged
        ? { unitCost: null, sku: "", leadDays: null, currency: p.currency, fx: 1 }
        : {}),
      drawingRequired: old?.drawingRequired ?? false,
      notes: `Projection plan: ${p.projection.columns} columns x ${p.projection.rows} rows; ${p.projection.widthM} x ${p.projection.heightM} m ${p.projection.kind} screen. Verify installation and hardware compatibility.${modelChanged ? " Model changed: previous pricing cleared; review any existing drawing ports and instances." : ""}`,
    };
  };
  const lines = [
    line(
      "projector",
      `${plan.projector.brand} ${plan.projector.model}`.trim(),
      count,
      plan.projector.brand,
      plan.projector.model,
      "Projection",
    ),
  ];
  if (!plan.projector.lensIncluded)
    lines.push(line("lens", plan.lens.name, count, "", plan.lens.name, "Optics"));
  if (p.projection.includeScreen)
    lines.push(
      line(
        "screen",
        `Projection screen · ${p.projection.widthM} × ${p.projection.heightM}m`,
        1,
        "",
        "",
        "Projection",
      ),
    );
  return lines;
}
export function applyProjectionBom(p: Project): Project {
  if (!calculateProjection(p.projection, p.projectionLibrary).canApplyBom)
    throw new Error(
      "Resolve optical errors and verify projector/lens profiles before updating the BOM.",
    );
  const lines = projectionBomLines(p);
  const items = p.items.map(
    (item) =>
      lines.find((l) => l.id === item.id) ??
      (item.id.startsWith(`projection-generated-${p.id}-`)
        ? {
            ...item,
            scope: "Excluded" as const,
            quantity: 0,
            notes: "No longer required by the current projection plan; retained for review.",
          }
        : item),
  );
  for (const line of lines) if (!p.items.some((i) => i.id === line.id)) items.push(line);
  return { ...p, items };
}
export function saveProjectionDesign(p: Project, title: string): Project {
  if (!title.trim() || title.trim().length > 120)
    throw new Error("Enter a design name of 120 characters or fewer.");
  if (p.projectionDesigns.length >= 50)
    throw new Error("This project already has 50 saved projection designs.");
  if (!calculateProjection(p.projection, p.projectionLibrary).solution)
    throw new Error("Choose a calculable projection design before saving.");
  const previous = p.projectionDesigns.find(
    (d) =>
      JSON.stringify([d.currency, d.taxRate, d.items]) ===
      JSON.stringify([p.currency, p.taxRate, p.items]),
  );
  const design: ProjectionDesign = {
    id: uid(),
    title: title.trim(),
    createdAt: new Date().toISOString(),
    projectName: p.name,
    customer: p.customer,
    currency: p.currency,
    taxRate: p.taxRate,
    bomSnapshotId: previous?.bomSnapshotId ?? uid(),
    bomRevision:
      previous?.bomRevision ?? Math.max(0, ...p.projectionDesigns.map((d) => d.bomRevision)) + 1,
    config: structuredClone(p.projection),
    library: structuredClone(p.projectionLibrary),
    items: structuredClone(p.items),
  };
  return { ...p, projectionDesigns: [...p.projectionDesigns, design] };
}
export function projectionArenaXml(p: Project): string {
  const plan = calculateProjection(p.projection, p.projectionLibrary);
  if (!plan.canExportArena || !plan.solution || !plan.nativeProjector)
    throw new Error("Resolve optical errors before exporting an Arena geometry preset.");
  return exportResolumeXml(
    plan.solution,
    plan.nativeProjector,
    p.projection.columns,
    p.projection.rows,
    { name: p.name, target: "preset" },
  );
}
export function importProjectionLibrary(
  current: ProjectionLibrary,
  input: unknown,
): ProjectionLibrary {
  const incoming = projectionLibrarySchema.parse(input);
  return projectionLibrarySchema.parse({
    projectors: [
      ...current.projectors,
      ...incoming.projectors.map((p) => ({ ...p, id: uid(), verified: false })),
    ],
    lenses: [
      ...current.lenses,
      ...incoming.lenses.map((l) => ({ ...l, id: uid(), verified: false })),
    ],
  });
}
