import test from "node:test";
import assert from "node:assert/strict";
import {
  ledProductSchema,
  productLayout,
  pdfSpecDraft,
  upsertLedProducts,
  readLedProducts,
} from "../src/features/workspace/led-products";
import { stateSchema, exampleState } from "../src/features/workspace/model";
const product = ledProductSchema.parse({
  id: "sample",
  manufacturer: "Fictional supplier",
  model: "Sample cabinet",
  widthMm: 500,
  heightMm: 500,
  pixelWidth: 256,
  pixelHeight: 256,
  pixelPitchMm: 1.95,
});
test("product sizing uses exact pixels, wall clearances and fixed all-in-one dimensions", () => {
  const fit = productLayout(product, 3100, 2100, "wall", 100, 100)!;
  assert.equal(fit.columns, 5);
  assert.equal(fit.rows, 3);
  assert.equal(fit.pixelWidth, 1280);
  assert.equal(fit.weightKg, null);
  assert.equal(fit.powerTypicalW, null);
  assert.equal(productLayout(product, 499, 600, "wall"), null);
  const aio = { ...product, kind: "All-in-one" as const };
  assert.equal(productLayout(aio, 3000, 2000, "desired")!.cabinets, 1);
  assert.equal(productLayout(aio, 500, 500, "wall", 1), null);
  const nearest = productLayout(product, 2850, 1720, "desired")!;
  assert.ok(Number.isInteger(nearest.columns));
  assert.ok(Number.isInteger(nearest.rows));
});
test("PDF prefills only unambiguous labelled values without inferring cabinet pixels", () => {
  const draft = pdfSpecDraft(
    "Cabinet dimensions: 500 × 500 × 40 mm\nCabinet resolution: 256 × 256 pixels\nPixel pitch: 1.95 mm\nBrightness: 800 nits",
    "sample.pdf",
  );
  assert.equal(draft["widthMm"], 500);
  assert.equal(draft["pixelWidth"], 256);
  assert.equal(draft["brightnessNits"], 800);
  assert.equal(
    pdfSpecDraft("Pixel pitch: 1.95 mm\nCabinet dimensions: 500 × 500 mm", "sample.pdf")[
      "pixelWidth"
    ],
    undefined,
  );
  assert.equal(
    pdfSpecDraft("Pixel pitch: 1.5 mm\nPixel pitch: 2.5 mm", "multi.pdf")["pixelPitchMm"],
    undefined,
  );
  assert.equal(
    pdfSpecDraft("Display resolution: 1920 × 1080 pixels", "screen.pdf")["pixelWidth"],
    undefined,
  );
});
test("reviewed library imports deduplicate variants and do not alter project snapshots", () => {
  const state = exampleState();
  state.projects[0]!.led.product = { ...product };
  const updated = upsertLedProducts([product], [{ ...product, id: "new", brightnessNits: 900 }]);
  assert.equal(updated.length, 1);
  assert.equal(updated[0]!.id, product.id);
  const distinct = upsertLedProducts(updated, [
    { ...product, id: "different", pixelWidth: 200, pixelHeight: 200 },
  ]);
  assert.equal(distinct.length, 2);
  assert.equal(
    stateSchema.parse({ ...state, ledProducts: updated }).projects[0]!.led.product!.brightnessNits,
    null,
  );
  assert.throws(
    () => upsertLedProducts([], [product, { ...product, id: "duplicate" }]),
    /duplicate/,
  );
});
test("uploads reject invalid dimensions, incomplete pixels, executable links and formula values", async () => {
  assert.equal(ledProductSchema.safeParse({ ...product, pixelWidth: 256.5 }).success, false);
  assert.equal(
    ledProductSchema.safeParse({ ...product, datasheetUrl: "javascript:alert(1)" }).success,
    false,
  );
  assert.equal(
    ledProductSchema.safeParse({ ...product, image: "data:image/svg+xml;base64,PHN2Zz4=" }).success,
    false,
  );
  const headers =
    "Manufacturer,Model,Cabinet width (mm),Cabinet height (mm),Cabinet pixels wide,Cabinet pixels high";
  const records = await readLedProducts(
    new File([headers + "\nExample,Sample,500,500,256,256"], "products.csv"),
  );
  assert.equal(records[0]!.widthMm, 500);
  assert.equal(records[0]!.powerMaxW, null);
  await assert.rejects(
    readLedProducts(new File([headers + "\nExample,Sample,500,500,,"], "incomplete.csv")),
    /pixelWidth/,
  );
});
