# System designer: drawings, BOM revisions and cable labels

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

Further designer work includes reusable equipment/port libraries, rooms/zones, manual cable waypoints and routing, multi-sheet schematics, connector/adaptor specifications, and dedicated label-printer templates. Rack multi-bay/front-back layouts remain separate work; the current rack view is one 42U elevation.
