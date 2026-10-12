# Original supplied LED builder specification

Reference material from the uploaded Lovable archive. Requirements below are not a statement of verified implementation.

# Soblabs Display Builder

Build a secure web application called “Soblabs LED Configurator” for a sales team to configure LED displays, calculate selling prices, save quotes, and export professional client-facing PDFs.

Deliver a functioning application with persistent storage and authentication, not only a visual prototype.

1. Users and security

Use invitation-only accounts with two roles:

Administrator: manage accounts, edit catalogues and business settings, and view and manage all quotes.

Salesperson: browse catalogues, create quotes, and view, edit, duplicate, and export only their own quotes.

Enforce permissions on the server and database, including quote items, customer records, drawings, and PDF files. Hiding interface elements is insufficient. Prevent users from changing their own role or accessing another salesperson’s records by changing a URL or request.

Use private PDF storage with authorized downloads. Include login, logout, password recovery, and account deactivation.

Default catalogue editing to administrators. All salespeople have unrestricted markup and margin controls and can choose among approved hardware combinations.

2. Application layout

Provide:

Dashboard with the current user’s recent quotes and a Create Quote button.

Quote library with search, filters, duplication, and draft/issued/accepted/declined statuses.

Display configurator.

LED product catalogue.

Processor and receiver-card catalogues.

Administrator account management and business settings.

Use a restrained, professional design under Soblabs branding. Start with a text logo and allow an administrator to upload a logo later.

The configurator should show configuration controls, a large 2D drawing, and a live specification/pricing summary. Prioritize desktop use while supporting tablets.

3. Editable LED product catalogue

Support multiple manufacturers, including Unilumin, Absen, MoonTechno, Sony, Planar, and Samsung.

Store each cabinet size and pixel-pitch combination as a distinct product variant. Fields should include:

Manufacturer, series, model, SKU, description, active/archived status.

Indoor/outdoor application.

Pixel pitch in millimetres.

Cabinet width, height, and depth in millimetres.

Exact cabinet pixel width and height.

Diode technology, manufacturer, package/model, and specification notes.

Power-supply brand/model, quantity per cabinet, and redundancy notes.

Typical and maximum power per cabinet in watts.

Cabinet weight.

Brightness, refresh rate, service access, and IP rating when known.

Supplier purchase cost per square metre and supplier currency, USD or CAD.

Approved receiver cards and processing system requirements.

Datasheet link, specification source, and last verification date.

Allow administrators to add, edit, duplicate, and archive products. Unknown specifications remain blank or say “Not specified”; do not invent values.

Use exact cabinet resolution for calculations because advertised pixel pitch may be rounded.

4. Display sizing

The first version supports rectangular displays using one fixed cabinet variant per display.

Allow entry in metres, millimetres, or feet/inches, with consistent internal units.

Provide two modes:

Wall size:

Enter available width and height.

Optionally specify installation clearances.

Find the largest whole-cabinet grid fitting within the usable space.

Never propose a display exceeding the available dimensions.

Explain when even one cabinet cannot fit.

Desired display size:

Enter target width and height.

Compare nearby whole-cabinet layouts.

Rank by smallest combined proportional width and height deviation, using smaller area as a tie-breaker.

Show the recommended layout and nearby alternatives with exact dimension differences.

Allow manual row and column adjustment.

Show:

Cabinet rows, columns, and total quantity.

Actual width, height, area in m² and ft², diagonal, and aspect ratio.

Total pixel width × pixel height.

Pixel density per m².

Cabinet weight total and typical/maximum display power when known.

Calculate using actual achieved display area, not requested area.

5. 2D drawing

Generate a clean, scalable front elevation showing cabinet grid, overall width and height, rows and columns, and wall boundary when applicable.

Generate a side profile showing cabinet depth. Allow separate mounting depth entry; distinguish cabinet depth from total installed depth. Do not treat unknown mounting depth as zero.

Use the same configuration data for the on-screen drawing and exported PDF.

Connectivity and wiring diagrams are a future phase. Preserve hardware model and cabinet quantity data to support that later, but do not generate unverified wiring plans now.

6. Processors and receiver cards

Maintain separate editable catalogues for processors and receiver cards, including manufacturer, model number, cost, currency, and technical specifications.

Include support for NovaStar, Colorlight, and manufacturer-specific systems.

Let salespeople select processor models and receiver cards from dropdowns. Filter choices using administrator-maintained compatibility relationships between the LED variant, receiver card, and processor.

Do not assume compatibility from brand alone. Allow products with integrated or proprietary processing so external hardware is not automatically added or charged twice.

Store receiver cards per cabinet and whether their cost is included in the LED price. Support explicit processor quantities.

Validate against documented capacity limits where available. If capacity data is incomplete, show “Technical verification required” rather than claiming the configuration is validated. Total pixel capacity alone does not establish full compatibility.

7. Costs, currency, and selling prices

Supplier costs are usually USD, but support USD and CAD per product or charge. Each quote has a single output currency.

Use an editable exchange rate expressed explicitly as “1 USD = X CAD.” Save the rate and its date with the quote. Require a valid rate when conversion is needed.

LED purchase cost equals actual display area in m² multiplied by supplier cost per m².

Include line items for:

LED cabinets/display.

Processors.

Receiver cards when not included.

Mounting structure.

Installation.

Spare parts.

Freight, with Air or Sea selection and manually entered cost.

Other custom charges.

Support quantity, unit cost, cost currency, and taxable status per charge. Prevent double-counting included components.

Allow quote-wide markup or margin with optional line-item overrides. There is no minimum-margin approval workflow.

Markup and margin are alternative inputs:

Selling price = cost × (1 + markup / 100).

Selling price = cost / (1 − margin / 100).

Changing one updates the other. Reject margin values of 100% or above and handle zero costs without division errors.

Show internal cost, selling price, gross profit, markup, and margin. Exclude tax from profit calculations.

Display both:

LED-only selling price per m² and ft².

Complete-system selling price per m² and ft², clearly labelled and excluding tax.

Use 1 m² = 10.7639104167 ft². Use decimal-safe monetary calculations and consistent rounding.

Tax is an editable percentage applied to taxable selling line items. Do not automatically assume a jurisdiction or tax rate.

8. Quote storage and duplication

Capture customer/company, contact details, project name, salesperson, quote number, dates, currency, exchange rate, configuration, line items, terms, and notes.

Provide unique quote numbers, save confirmation, and protection against losing unsaved changes.

Save a snapshot of specifications, costs, exchange rate, compatibility selections, and selling prices with each quote. Later catalogue changes must not silently alter saved quotes.

Duplicating creates a new quote number and draft. Offer:

Keep original specifications and prices.

Refresh from the current catalogue, with a change preview.

Preserve issued quote versions and their PDFs. Editing an issued quote should create a revision.

9. Client-facing PDF

Export a polished Soblabs quotation containing:

Logo/company details.

Quote number, revision, issue date, and validity date.

Customer, project, and salesperson details.

Dimensioned front and side drawings.

Selected product, pixel pitch, diode specification, dimensions, area, cabinet count, resolution, and pixel density.

Power supply, power consumption, weight, processor, and receiver-card details when known.

Itemized customer selling prices.

LED selling rate per m² and ft² with clear labels.

Subtotal, editable tax, total, and explicit USD or CAD designation.

Air or sea freight description.

Editable payment terms, lead time, warranty, and exclusions.

Never include supplier purchase costs, exchange-rate working calculations, profit, markup, margin, or internal notes in the client PDF.

Build the PDF from an explicit client-safe set of fields. Support multipage quotes with clean page breaks and no clipped drawings or tables.

10. Initial data and verification

Create manufacturer entries, but do not fabricate real product specifications, prices, or compatibility. Use a clearly labelled fictional demonstration product to exercise the configurator. Keep demonstration quotes visibly marked.

Verify these workflows before calling the application complete:

A salesperson cannot access another salesperson’s quote or PDF, even through direct requests.

An administrator can access all quotes and manage accounts.

Catalogue edits do not change saved quote snapshots.

Wall-fit calculations never exceed available dimensions.

Desired-size mode returns whole-cabinet layouts.

Resolution uses exact cabinet pixels.

USD/CAD conversion and both area-price units agree.

On a $100 cost, 25% markup yields $125 and 25% margin yields $133.33 after rounding.

Freight, included hardware, and tax are counted correctly.

Duplicating a quote does not modify the original.

Client PDFs contain no internal financial fields.

Implement in stages: authentication and permissions, catalogues, sizing and drawings, pricing, then quote storage and PDF export. Clearly identify any unfinished integration instead of substituting a mock success message.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/89935fad-aaa9-4683-8539-41938b6f4bc2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
