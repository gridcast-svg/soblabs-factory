# Factory projection planner

Factory adapts [Blend Calc](https://github.com/stoatworks-labs/blend-calc) at
`de187a161b6ee926a18727341b04dc81237a4044` under MIT. The original notice is
retained in `src/vendor/blend-calc/LICENSE` and served at
`/licenses/blend-calc.txt`. Only pure geometry, unit conversion, domain types and
the Resolume exporter are vendored. No dependencies, seed catalogue, service
worker, hosting scripts or upstream UI are installed.

## Workflow

Open **Projection planner** in a project. Old projects gain empty equipment and
design collections; existing LED, AV and CRM data is preserved. The new planner
uses Factory's existing browser/account persistence and workspace backup system.

- **Screen:** flat or cylindrical, physical width/arc length, height, radius,
  screen gain and an optional screen-material BOM line. Metres and feet are
  display units; the stored geometry remains in metres.
- **Array:** projector rows/columns (up to 256 positions), fit-width, fit-height
  or manual overlap. Overlaps are fractions of one projector image, 0–50%.
- **Equipment:** select a projector and explicit lens, or recommend a compatible
  lens from the declared mount family. Add/edit profiles with actual native
  resolution, rated lumens, lens zoom range, absolute H/V shift limits, source
  reference and verification status. Changing profile fields clears verification.
  An included lens is used for optics without adding a separately priced BOM line.
- **Throw:** per-tile on-axis placement or a common rig point, and perpendicular
  nominal throw distance. The schedule lists required ratio and shift per position,
  horizontal slant distance, local lens zoom-distance ranges and blend edges.

An optional, explicitly synthetic example helps explore the UI. Its profiles
remain unverified and cannot update the BOM. No real manufacturer specifications
are fabricated. Unknown rated light output stays unknown, not zero luminance.

Front elevation shows image footprints, overlaps and the requested screen;
curved elevation is unwrapped. Plan view shows the actual screen curve and
horizontal coverage by column. Rows sharing a horizontal position share that
plan view. **Expand projection planner** fills the browser viewport; Escape
returns to Factory. The whole design fits at 1920 x 1080 and 3840 x 2160, with
zoom controls for detail. Projector labels remain clear of screen boundary lines.

Equipment library JSON export/import supports reuse across projects. Imports
show a count preview, receive new IDs and have verification cleared; existing
profiles are retained. Mount-family names are retained and must be checked for
real compatibility. Imports are limited to 2 MB, 200 projectors and 500 lenses.

## BOM and saved designs

The preview lists projectors, separate lenses and optional screen material.
Source-checked profiles, a valid optical plan and explicit quantity review are
required before application. Generated IDs are stable, so repeat updates do not
duplicate rows. Existing manual rows stay separate and need duplicate review.
Unneeded generated rows become excluded with zero quantity to retain drawing
references. Prices/FX/SKUs survive quantity changes for the same model. Changing
a model clears its price/SKU/lead time; existing drawing ports remain for review.
Mounting, control equipment and cabling are not invented automatically.

Named saved designs retain full configuration, the equipment library, project
identity, currency/tax and a full current BOM snapshot. Matching BOM contents
reuse a snapshot ID/revision; changed contents get a new revision. Revisions are
scoped to projection BOM snapshots. Up to 50 designs can be saved per project;
removal is reversible through workspace Undo. Opening an old layout restores its
configuration/library without replacing the current BOM, and provides Undo.

## Exports and calculation boundaries

- Technical PDF: dimensioned elevation, plan view, optical schedule, source and
  verification status, current diagnostics and, for saved designs, their captured
  technical BOM. Saved reports use saved project names, geometry and library data.
  An explicit field selection excludes supplier costs, markup, profit, FX and
  internal notes. Draft reports may include optical errors, clearly listed.
- SVG exports the current drawing view; CSV exports numeric optical schedules.
- The Resolume Arena geometry preset uses the vendored exporter targeting Arena
  7.27. It supplies virtual outputs, composition slices and identity warps. It
  does not configure physical outputs, per-edge soft blending or curved-screen
  calibration. It has not been round-trip tested in Arena or on real projectors
  here. Only supported optical geometry can export a preset.
- Factory guards unsupported overlap solutions, nonfinite/negative optical
  geometry, arcs crossing optical reference planes and tiles spanning 180°.
  Screen regions left uncovered block BOM and Arena application.
- The upstream core checks horizontal shift. Factory additionally checks vertical
  shift per row. Unknown required shift limits block application. Independent
  H/V limits do not prove a coupled shift envelope; simultaneous-axis designs
  explicitly require separate manufacturer verification.
- Factory lens recommendations filter mount, ratio and declared H/V limits, and
  prefer source-checked profiles. A matching mount name is a user declaration,
  not an independently verified compatibility database.
- Upstream luminance sums rated flux over unique screen area. Factory replaces
  this with the dimmest nominal single-image estimate so compensated overlap does
  not increase brightness by counting duplicated flux. This remains an ideal
  estimate before ageing, ambient light, lens losses, masking or curved incidence.
- Lens zoom-distance ranges use the current local image geometry. Moving the rig
  on a curve changes that geometry and requires recalculation. The schedule's
  slant distance is horizontal; vertical physical mounting still needs design.
- Analytic pixel budgets can be fractional. The displayed/exported integer
  composition follows actual rounded slice bounds from the Arena exporter.

## Validation

`npm test` includes `tests/projection.test.ts`: legacy migration, pixel conservation,
independently calculated throw/light results, both shift axes, auto-lens filtering,
flat/curved limits, singular arcs, uncovered screen rejection, unverified imports,
idempotent BOM updates and price invalidation, immutable saved designs, Arena XML
escaping/geometry and input bounds.

`tests/browser/projection.spec.ts` covers equipment creation/verification reset,
repeat BOM application, saved PDF contents/pricing exclusion, Arena XML parsing,
library import preview, persistence/project isolation and 1080p/4K drawing framing.
The production build and `npm run test:sandbox` exercise AV, LED and projection
tools plus actual LED/projection PDF downloads through the authenticated gateway.

## Epson room example and paper canvas

An untouched, empty projection setup opens on a labelled **preview** of an 8×10×3 m room, centred 4×2.25 m front-wall screen, one Epson EB-PQ2010W with ELPLM15 at 6.5 m throw. Opening the preview does not write project data. **Use Epson room example**, an edit, a save, or an explicit BOM update adopts it. Existing configured setups and equipment libraries are preserved. **Add Epson equipment** merges missing curated profiles without replacing local edits.

The Room tab controls the plan-view boundary. Screen dimensions and nominal throw are checked against room dimensions; this is not a ceiling, obstacle or audience sightline model. The Equipment tab separates native panel resolution from displayed/pixel-shift resolution. The Epson example plans a 3840×2160 output raster while retaining the factual 1920×1080 panel specification. Older projects keep their native-raster behavior.

Three PQ-series projectors and nine compatible conventional lenses are sourced from downloaded Epson documentation, with local PDF links in the library. See [source provenance](../public/specs/epson/README.md). The existing review checkbox still guards BOM application, and product costs remain unknown.

Both planners use Boldcase paper canvases by default with a persistent dark-canvas option. SVG/PDF print exports retain a white background and high-contrast colors.
