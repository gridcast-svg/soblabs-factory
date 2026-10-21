# Factory LED planner

The workspace LED configurator adapts the pure calculation modules from
[Calculator LED Pro](https://github.com/matecodedev/calculator-led-pro), pinned at
`7bc11b4e42fb484958b448021594b735bf3586dc`, under MIT. The original notice is in
`src/vendor/calculator-led-pro/LICENSE` and served at
`/licenses/calculator-led-pro.txt`. No upstream packages, service worker,
catalogue, hosting configuration, scripts or mobile UI are installed.

## Workflow

1. Open **LED configurator** in a project. Old workspace geometry is preserved.
2. **Layout** fits whole cabinets inside the available wall or sets explicit
   columns and rows. Enter exact cabinet dimensions and pixel resolution.
3. **Cabinet** records manufacturer/model, maximum/typical power, weight,
   audience distance and specification provenance. Unknown values stay blank.
4. **Processing** records the actual per-port pixel budget, output count, total
   pixel budget and maximum canvas dimensions for the chosen operating mode.
5. **Installation** sets voltage (initially 120 V), breaker and connector limits,
   rack distance, screen height, cable allowance, and declared rigging parameters.
6. Choose Data or Power routing, direction, start corner and main routing policy.
   Automatic routing uses upstream serpentine paths. Manual mode starts from the
   current automatic plan; clear the layer to redraw it. Select adjacent cabinets,
   start new runs, or undo. Resized manual routes remain in storage and are flagged
   for repair rather than silently discarded. Auto-route replaces that layer.
7. Review the BOM preview, confirm specifications, then **Update project BOM**.
   Generated cabinet, processor and cable quantities update stable item IDs.
8. **Save LED design** retains the layout, all specifications and manual paths,
   project/customer identity, currency, tax and a full copy of the current BOM.
   BOM snapshots share an ID/revision when their contents match; changed contents
   receive a new snapshot/revision. These revisions are scoped to saved LED BOMs.
9. Export the current technical PDF, the visible routing layer as SVG, or the
   cable schedule as CSV. **Export saved PDF** uses saved specifications and BOM
   contents even after the working layout, project name or current BOM changes.
   Opening a saved layout updates the working layout only; review the preview to
   apply quantities to the current BOM explicitly.

**Expand LED planner** fills the browser viewport; Escape returns to Factory.
The routing drawing fits the complete grid at 1920 x 1080 and 3840 x 2160.
Zoom controls provide closer inspection. The canvas limit is 5,000 cabinets;
each project can retain up to 50 named designs, removable with workspace Undo.
Saved designs are included in workspace backup/restore and existing persistence.
Sandbox persistence remains browser-local; this feature adds no new authentication
or cloud synchronization mechanism.

## Integration boundaries

- Factory retains its floor-based wall-fit geometry. Upstream dimension targeting
  rounds up to cover a requested size and is deliberately not used for wall-fit.
- The adapter rejects a cabinet larger than one data port's pixel budget or one
  circuit's usable power. The upstream capacity functions clamp those cases to one;
  that fallback must not make an impossible configuration look feasible.
- Missing product specifications produce unknown outputs, not zero power/weight
  or fabricated catalogue specifications. Real manufacturer catalogue ingestion
  and receiver-card compatibility are not supplied by this integration.
- The processor count is an estimated minimum across drawn run count, controller
  pixel limits and canvas dimensions. It does not solve processor-region partitioning,
  generate hardware configuration files, or prove receiver compatibility/redundancy.
- Breakers use the upstream 80% planning factor, capped by connector rating.
  Watts/volts current assumes power factor 1 and needs manufacturer input-current
  verification. Rigging arithmetic covers cabinet weight only, not a structural design.
- Main lengths include the entered rack distance, vertical climb and slack, rounded
  to upstream stock lengths. Runs above 50 m block BOM application rather than
  silently becoming a 50 m cable. Signal distance, fibre requirements, voltage drop,
  connector selection and jumper lengths remain design tasks. The view is explicitly
  labelled as drawn; confirm front/rear cabinet orientation before installation.
- Manual routing checks coverage, duplicate/out-of-grid cells, capacity and adjacency.
  Incomplete or invalid manual routes block BOM updates; draft reports retain checks.
- Existing manual BOM items remain separate and need duplicate-equipment review.
  Existing generated prices, currency, FX, SKUs, ports and placements are preserved;
  an explicit area cost replaces cabinet pricing in project currency. Obsolete
  generated rows become excluded with zero quantity, preserving drawing references.
- PDFs use an explicit technical field selection and omit supplier costs, markup,
  profit, exchange rates and internal BOM notes, including in saved BOM schedules.
- This is a native Factory integration, not an iframe; the AV frame policy is unaffected.

## Validation

`npm test` includes `tests/led-planner.test.ts`: legacy migration, fit/count sizing,
all eight routing directions/corners and both main policies, coverage/adjacency,
electrical/processor limits, impossible capacities, manual routing errors, long
main rejection, rigging overloads, idempotent BOM updates, preserved metadata and
immutable/versioned BOM snapshots.

`tests/browser/led-planner.spec.ts` covers manual routing, confirmation invalidation,
repeat BOM application, saved PDF text (including earlier geometry and no supplier
price), persistence, restore, CSV download and project isolation. It also checks
whole-grid framing at 1920 x 1080 and 3840 x 2160. Run it with the normal browser
test prerequisites in `docs/IMPLEMENTATION.md`.

After `npm run build`, `npm run test:sandbox` verifies the built application through
the authenticated production gateway, including both the LED planner and AV editor.

## Pixel pitch and display specifications

Layout offers common pitch presets and custom millimetre targets. Cabinet width/height divided by target pitch is rounded to whole pixel counts (bounded to 1–100,000 per axis). The summary shows the actual horizontal and vertical pitch, pixel density and total display pixels; the requested target is never silently presented as an exact manufactured pitch. Cabinet dimension changes recalculate in target mode. Editing pixel counts explicitly returns to exact-pixel mode.

Cabinet adds optional rated brightness (nits) and refresh rate (Hz). These values come from product specifications; neither is inferred from pixel pitch. Unknown values remain blank. Pitch target, brightness and refresh persist in saved designs, workspace backups and PDF reports. Existing layouts migrate to exact-pixel mode with unknown brightness/refresh.
