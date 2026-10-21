import { projectionConfigSchema, projectionLibrarySchema } from "./projection-schema";
import type { Project } from "./model";
const brochure =
  "https://mediaserver.goepson.com/ImConvServlet/imconv/381cda380258a5980eec9191886db188dfd107da/original?assetDescr=Pro_Series_Projector_Brochure_EB-PQ2000_EB-PQ2200_CPD-64228R1_Single-Page_Final.pdf";
const datasheet =
  "https://mediaserver.goepson.com/ImConvServlet/imconv/38ad1942432d1d062c6373d64712f7db9bfa71b0/original?assetDescr=EB-PQ2010W_Projector_Specification_Sheet_CPD-64128R2.pdf";
const mount = "Epson PQ2000/PQ2200";
export const epsonLibrary = projectionLibrarySchema.parse({
  projectors: [
    ["EB-PQ2008B", 8000],
    ["EB-PQ2010W", 10000],
    ["EB-PQ2213B", 13000],
  ].map(([model, lumens]) => ({
    id: `epson-${model}`,
    brand: "Epson",
    model,
    mount,
    nativeWidth: 1920,
    nativeHeight: 1080,
    displayWidth: 3840,
    displayHeight: 2160,
    resolutionNote:
      "1920 × 1080 panels; 3840 × 2160 on-screen using 4K Crystal Motion pixel shifting.",
    lumens,
    lensIncluded: false,
    source: model === "EB-PQ2010W" ? datasheet : brochure,
    verified: true,
  })),
  // Ratios are for the PQ series only. Shift envelope is confirmed only for M15.
  lenses: [
    ["ELPLU03S", 0.46, 0.56],
    ["ELPLU04", 0.62, 0.75],
    ["ELPLW05", 0.74, 1.04],
    ["ELPLW06", 1.15, 1.57],
    ["ELPLW08", 0.83, 1.17],
    ["ELPLM15", 1.52, 2.47],
    ["ELPLM10", 2.34, 3.59],
    ["ELPLM11", 3.42, 5.23],
    ["ELPLL08", 5.09, 7.16],
  ].map(([name, min, max]) => ({
    id: `epson-${name}`,
    name,
    mount,
    throwRatioMin: min,
    throwRatioMax: max,
    hShiftPct: name === "ELPLM15" ? 18 : null,
    vShiftPct: name === "ELPLM15" ? 60 : null,
    source: name === "ELPLM15" ? datasheet : brochure,
    verified: true,
  })),
});
export function epsonRoomExample(project: Project): Project {
  return {
    ...project,
    projection: projectionConfigSchema.parse({
      rasterMode: "display",
      widthM: 4,
      heightM: 2.25,
      columns: 1,
      rows: 1,
      throwDistanceM: 6.5,
      projectorId: "epson-EB-PQ2010W",
      lensId: "epson-ELPLM15",
      room: { widthM: 8, depthM: 10, heightM: 3 },
    }),
    projectionLibrary: structuredClone(epsonLibrary),
  };
}
export function isEmptyProjection(project: Project): boolean {
  return (
    !project.projectionLibrary.projectors.length &&
    !project.projectionLibrary.lenses.length &&
    !project.projectionDesigns.length &&
    JSON.stringify(project.projection) === JSON.stringify(projectionConfigSchema.parse({}))
  );
}
