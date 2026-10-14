# LED product selection and specification uploads

Factory's workspace LED configurator now uses three steps: Setup, Product, and Configuration. The Sony Crystal LED configurator and the supplied product-search screenshot inform the layout; Factory retains its own branding and dark workspace theme. No Sony/Philips product images or product specifications are copied into the catalogue.

## Configure a display

Enter the available wall or desired display dimensions in millimetres, metres, or decimal feet. Wall mode respects per-edge side and top/bottom clearances. Desired-size mode ranks nearby whole-cabinet layouts. Exact cabinet pixel counts drive resolution; rounded pixel pitch never supplies pixel counts. An all-in-one product is a fixed one-by-one display, not a repeatable cabinet. Layouts over 5,000 cabinets cannot be selected or added to the BOM.

Browse cards or a compact list. Search manufacturer, series, model, or SKU. Group by series/manufacturer and sort by model name, pixel pitch, or closest achieved size. Filter environment, series, pitch, minimum brightness/refresh rate, maximum typical power per cabinet, and contrast ratio. Unknown values do not pass numeric filters. Card information can include picture, pitch, achieved size, resolution, brightness, refresh rate, typical display power, contrast, and dimension differences.

The Configuration step shows dimensioned front/side drawings, actual area, exact resolution, cabinet quantity, power, weight and source. Unknown mounting depth, power and weight stay unspecified. Review specifications before updating the project BOM. Repeating the BOM update replaces the same generated line rather than adding duplicates. Imported supplier currency is preserved; a mixed-currency BOM needs an explicit exchange rate. Processing, mounting, receiver compatibility and cabling still require design.

## Primary upload: manufacturer PDF datasheets

Select **Upload specifications** and choose a text-based PDF. The review dialog shows extracted source text alongside editable product fields. A conservative parser prefills a single explicitly labelled cabinet size/resolution, pitch, brightness, refresh rate, or cabinet weight. Ambiguous repeated labels remain blank. Multi-model tables require the user to select one variant and enter its values; this is not an AI table parser.

Required fields: manufacturer, model, cabinet width/height in mm, and exact cabinet pixels wide/high. Optional fields include series/SKU, cabinet versus all-in-one type, indoor/outdoor environment, pitch, depth, brightness, refresh rate, contrast, per-cabinet typical/maximum power, weight, supplier cost/currency, datasheet URL and specification source. Confirm the record against its source before saving. Each cabinet geometry/resolution variant is a distinct record.

PDF limits: 5 MB, 100 pages, 80,000 extracted text characters. Scanned/image-only PDFs require manual product entry; OCR and automatic extraction of embedded product images are not included. The extracted source text and file name are saved, not the original PDF binary. Keep the original datasheet independently or add its HTTPS link.

Upload an optional PNG/JPEG/WebP product image up to 200 KB. Images are stored in the workspace with the record. SVG and arbitrary remote image URLs are not accepted. Missing pictures show a labelled placeholder.

## Other entry methods

**Add product** opens the same reviewed form. **Spreadsheet template** downloads the supported CSV columns. CSV, XLSX (LED Products sheet or first sheet), and JSON arrays are supported, with 5 MB/500-row upload limits. Numeric columns need plain numbers in the named units; XLSX formulas and linked cells are rejected. Blank optional specifications remain unknown. Imports preview adds/updates and require confirmation.

Manufacturer, model, SKU, cabinet dimensions and exact pixels identify a variant. Reimporting the same variant updates its library record and preserves its ID. Duplicate variants within one upload are rejected. Imports do not delete products. The library supports up to 500 variants.

## Storage and existing projects

The product library belongs to the current Factory workspace: browser-local in the design sandbox and owner-scoped in account mode. This does not modify or synchronize the separate administrator-led global catalogue at `/catalogue/led`. Team-wide catalogue management remains a separate workflow.

Selecting a product copies its specifications into the project. Later library imports do not change saved configurations or BOM costs. Reselecting a product applies the current library specification. Existing workspace backups still load; their LED geometry remains present. Those older projects can select a library variant or add a verified product to continue through the new workflow.

An empty library shows one explicitly fictional cabinet for testing. There are no real manufacturer specifications or prices in that example. No LLM connection, paid extraction service, or new database migration is required.

## Verification

Unit tests cover wall clearances, exact resolution, all-in-one sizing, ambiguous PDF fields, variant deduplication, snapshot preservation, and unsafe/incomplete uploads. Browser tests cover PDF review, persistence, search/filter/list view, unit conversion, repeated BOM updates and workbook export. Desktop, tablet and phone layout checks use fictional fixtures.
