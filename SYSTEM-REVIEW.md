# CAMY system review — 16 September 2026

Implemented database-backed staff accounts, temporary passwords with mandatory first-login replacement, password reset and session revocation, server-side role checks, session expiry, sign-in throttling, cross-site write protection, private-file protection and administrative audit logs. New installations generate private bootstrap credentials rather than using a shared password.

Stock requests expose all stages and full item, contact, bank and payment details. Pending requests can be edited, accepted or rejected. Receipt correction and verification enforce the proper stages. Cancelling reserved stock releases it; customer returns restore stock once. Dialogs use body portals with keyboard focus, Escape and scroll locking and fit desktop/mobile viewports.

Business records now read from MySQL tables, with historical snapshot migration and a compatibility snapshot. Profiles, closure decisions, tier changes and verified credit settlements persist through validated API endpoints. Financial summaries use saved records and delivered customer orders. Catalogue edits use explicit saves, concurrency checks and draft protection during refresh. An application error boundary prevents an unexpected rendering error from becoming an unexplained blank screen.

All existing report download handlers produce genuine XLSX workbooks: branded headings, filters, frozen headers, readable columns, typed dates and LKR currency, totals and separate order-item sheets. Phone numbers and identifiers retain text formatting; user text cannot execute as a formula. The workbook package follows [Microsoft's SpreadsheetML structure](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document).

Validation completed:

- Production frontend build and syntax checks for every API PHP file.
- Isolated API tests for supply approval, edit, payment correction, verification and dispatch; customer tracking, approval, payment, delivery and return; ownership and stage guards.
- Staff authentication tests covering temporary passwords, mandatory change, session revocation, role restrictions, suspension, cross-site requests, audit logging and rate limiting.
- Workbook generation tests and independent .NET ZIP/XML validation of workbook parts, styles and sheets.
- Chrome checks for login rendering, desktop/mobile request dialog positioning, focus restoration, Escape, scroll lock and edit/accept/cancel controls using fictional UI fixtures.
- Existing database audit: 10 products, 5 entrepreneur records, 1 supply request, 25 inventory records, 16 customer orders; no invalid quantity, price or line-total findings.

Database backup taken before migration: `private/backups/camy-before-audit-20260916-170431.sql`. Existing records, including historical training records, were preserved. The training loader now refuses to run against the default live database.

These checks cover the listed flows; they are not proof that every possible issue is absent. Bank transfers still require confirmation against the actual bank account. Workbook structure was independently validated; desktop Excel was not available for an interactive opening check. Production hosting, HTTPS and bank/SMS integrations are outside this local verification.
