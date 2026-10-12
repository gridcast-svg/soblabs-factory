# Soblabs Factory CRM

## Core workflows

The CRM now has separate Accounts, Contacts, Leads, Deals, and Activities modules. Accounts hold company details, billing address, industry, type and ownership; related people, deals, activities and projects appear in the account editor.

Contacts and leads store company/account links, job title, email, phone, owner, status and notes. Converting a lead keeps its person ID and existing activity links, creates or explicitly selects an account, and optionally creates an opportunity. Ambiguous company matches require account selection.

Deals support Qualification, Needs analysis, Proposal, Negotiation, Won and Lost, with value, currency, owner, expected close date, notes, primary contact and project links. A saved won deal can create one linked project. Open deal values are reported separately for CAD and USD; currencies are never combined without an explicit rate.

Activities log tasks, calls, meetings, correspondence and notes, with links to accounts, people, deals and projects, due dates, ownership and completion. Email activities are records, not sent messages. Existing project/PLAUD follow-up tasks remain in the project workspace; CRM activities are a separate collection.

Search, owner filters and status filters apply to the relevant module. Accounts can be exported to Excel. Records with related records cannot be deleted until their links are reassigned. The existing workspace undo and backup/restore workflows cover the CRM data too.

## Zoho accounts import

Open CRM > Accounts > Import Zoho accounts. CSV, XLSX and JSON are supported, up to 5 MB / 5,000 records per import. JSON accepts a record array or Zoho's `data` array. XLSX uses an Accounts sheet or the first sheet. CSV handles comma/semicolon/tab separators, quoted commas, escaped quotes, Unicode BOMs and multiline fields.

The import preview exposes column mapping for Account Name, Account ID, Account Owner, phone, website, industry, Account Type, billing address, notes and source timestamps. Common Zoho API/export field names are recognized. Unmapped fields are retained for reference in the account detail view. Preserve the original export independently.

- Zoho account IDs are strings. Preserve them as text in Excel/JSON; unsafe numeric IDs are rejected.
- Exact Zoho IDs match existing Zoho records first. Without an ID, a unique company-name match needs confirmation. Ambiguous names and duplicate file identities block the import.
- Different Zoho IDs remain separate, even when company names match.
- The default policy fills missing account fields. The optional update policy replaces mapped fields with nonblank source values. Blank cells never erase existing values.
- Imports never delete accounts. Reimporting records with the same Zoho IDs updates existing records rather than adding duplicates.
- Imported account renames keep linked contact/project company labels in sync.

This task did not retrieve or import the real Zoho account records. The referenced Codex task's thread reader returned a connection error twice, and no export was available in the workspace. Obtain the account export through the user or a functioning authorized connector. Do not invent accounts, embed customer records in public source, request credentials in chat, or describe the manual importer as live Zoho synchronization.

## Storage and compatibility

Existing version-1 workspace backups load with empty new CRM collections and default contact/account links. Existing contacts, projects, drawings, BOMs and notes remain intact. Referential checks reject dangling CRM links and duplicate Zoho account IDs. Existing Supabase JSON workspace persistence can store the new collections; no additional database migration is required for this iteration.

The deployed design sandbox continues to store records in each browser under preview-password protection. It does not provide a shared company database, user-specific permissions or MFA. Use sample exports for review until the secure account backend is configured and validated for production customer records. Secure account mode uses the existing owner-scoped workspace and its MFA/active-account database policies when configured.

## Remaining functionality

This adds the core record and sales workflow, not full Zoho feature parity. Live Zoho sync, contact/deal bulk imports, Microsoft 365 capture, automatic daily updates, custom field administration, automated workflows, advanced reports, audit history, multi-user sharing and record-level team permissions remain to be implemented.

## Validation

`npm test` includes CRM migration, CSV/JSON parsing, deduplication, sparse update, lead-conversion and reference checks. `npm run test:browser` exercises imports/reimports, editing and persistence, conversion, won-deal project handoff, activities and older browser workspaces. Tests use synthetic records, not customer data.
