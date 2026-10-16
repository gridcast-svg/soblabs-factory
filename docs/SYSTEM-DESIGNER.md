# System designer: drawings, BOM revisions and cable labels

## Interactive AV editor

The Schematic tab now embeds the actual MIT ngDiagram AV schematic starter, built as local assets from `apps/av-editor`. It is not an iframe to the external demo. Its equipment palette, input/output device blocks, connector editor, manual wire routing, endpoint relinking, port navigation, minimap and light/dark themes remain available. Factory opens it in its dark palette and provides full-screen mode for desktop design work.

Desktop benchmarks are 1920 × 1080 and 3840 × 2160 CSS pixels. **Expand designer** uses the full browser window; **Full screen** uses the browser fullscreen API. Both keep a compact Return to Factory toolbar. Side panels are 280 px wide, and **Hide panels** clears both panels while retaining their previous visibility for restoration. The inline canvas follows the window height.

Initial framing and **Fit all** include the complete system and cap enlargement at 85%, so small projects are not inflated on large monitors. Larger systems fit at a lower zoom. Resizing or entering/exiting full-window/fullscreen mode reframes the system; selecting equipment does not change zoom. The percentage button returns to **100%** for detailed editing. These are viewport changes only; drawing coordinates, BOMs and export geometry remain unchanged. Browser benchmarks exercise an 18-device, six-column system at both target resolutions, including full-window/fullscreen dimensions, fit bounds, zoom controls and returning to Factory.

Existing Factory projects load directly; no migration/import step is required. Edits automatically update the current project's equipment instances, equipment specifications and cable records through a same-origin, source-checked, generation-checked and schema-validated bridge. The editor receives technical equipment data only, without BOM prices or account credentials. Changing an equipment specification updates the other instances of that BOM item; tags and locations remain per instance. Existing rack positions and costs are retained.

Project BOM equipment appears in the palette with a BOM badge. Dragging it places another instance; edit shared specifications on the canvas or in Factory's properties panel. The other palette entries are starter templates, and **Add device** creates a custom template. Template changes persist per project. Dropping a new template creates a BOM line with unknown cost, and repeated placements of that template reuse its BOM identity. Removing instances keeps the BOM line and quantity for review. Factory's **BOM links & rack properties** panel sets cable lengths, cable BOM associations and rack positions for the canvas selection.

Unfinished cable stubs persist as drafts, carry their metadata through reconnection and appear as outstanding design checks. Only completed connections enter the cable schedule and label PDF. Saved drawing revisions preserve unfinished stubs as well as manual routes and port geometry.

The embedded **Export** menu downloads the current working design as PNG or vector DXF. Use Factory's saved revision controls for revision-specific SVG/PDF sets and cable labels. The schematic SVG/PDF renderer now uses the editor's measured ports and routed wire points, two-column device blocks and a Soblabs engineering sheet border/title block. Long device/port text is shortened on the drawing; full equipment details remain in the PDF schedules. Multi-sheet schematic pagination remains future work.

Upstream provenance, license and build instructions are in `apps/av-editor/FACTORY-INTEGRATION.md`. The root build compiles both applications, so the existing Render service needs no second service or URL. Generated editor assets are ignored by Git. The Angular framework was patched to 21.2.25 while ng-diagram stays pinned to the upstream-tested 1.3.0 release.

The working designer remains linked to the selected project's live BOM. Equipment instances share BOM item identities, port specifications, rack heights and cable mappings. Cable paths now use signal colours; dashed paths identify missing BOM links. Cable IDs are checked for blanks/duplicates, and new connections receive an unused C-number.

## Save a coordinated revision

In System designer, enter a drawing number/title, linked BOM name and optional revision notes, then select **Save drawing revision**. This captures the schematic positions, rack positions, connections, equipment specifications and complete BOM together. The snapshot also preserves the project/customer name, currency, tax settings, timestamp and a stable BOM snapshot ID.

Drawing revisions increment independently for each drawing number. Layout-only changes reuse the exact existing BOM snapshot. Changes to BOM lines/specifications/pricing/currency/tax produce a new named BOM revision. Returning to previously saved identical BOM contents reuses that snapshot. An unchanged BOM can support different drawing numbers.

Each project currently has one editable working BOM. Named saved snapshots retain earlier versions and alternatives; this does not add multiple parallel working BOM editors. Saved revisions are read-only exports/previews. Continuing canvas edits affects the working design, not the selected saved revision. This avoids silently replacing an approved design's BOM when costs, quantities or equipment change.

The BOM page lists its associated drawing revisions. Deleting an item from the working BOM does not delete it from saved revisions. Old workspace backups migrate with empty drawing histories. Workspace JSON backups include drawing history and full internal BOM data; keep those backups private.

## Export a saved revision

- **PDF set:** A3 vector schematic and rack elevation, paginated cable schedule, device-tag-to-BOM schedule, selected equipment/material list, revision notes and outstanding design checks. Equipment lists omit prices, costs, markup and margins.
- **Saved schematic/rack SVG:** self-contained vector drawing with drawing number/revision, named BOM revision, timestamp and BOM snapshot ID.
- **Cable schedule CSV:** exact cable IDs, device/port/connector endpoints, cable type, specified length and BOM part/SKU references. Formula-like text is escaped for spreadsheet safety.
- **Cable labels PDF:** two labels per connection, marked ends A/B with the same cable ID and endpoint information. Generic A4 layout uses 90 x 28 mm cells; print at 100% and verify paper/printer margins. This is not a printer-vendor-specific template. Long IDs/names produce a clear error instead of silently clipping the label; use the CSV with label software when needed.

Draft exports include unresolved checks instead of claiming engineering approval. These checks cover recorded quantities, references, connector descriptions, cable lengths and rack space. They do not certify electrical/signal compatibility, power/loading calculations, connector gender, adapters, real cable routes or site dimensions.

## Persistence and scope

Drawing history uses the existing workspace persistence: browser-local in the design sandbox; owner-account JSON storage only when the separate Supabase login/MFA/backend is configured. Saving a local revision does not create a SharePoint file or establish shared cloud storage.

The requested reference is https://technipatch.com/examples. Its server returned HTTP 403/error 1010 to this environment, so its exact examples could not be reviewed. This implementation follows the user's priorities: system schematics, cable labels, drawing exports and BOM association. It does not claim feature parity or import Technipatch project files.

Further designer work includes richer rooms/zones, multi-sheet schematics, connector/adaptor specifications, and dedicated label-printer templates. Rack multi-bay/front-back layouts remain separate work; the current rack view is one 42U elevation.
