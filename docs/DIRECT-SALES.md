# CAMY Direct Sales

Direct Sales is a separate business ledger, available under **Admin → Customer Orders → New Direct Sale**. Existing COD, assisted orders, commissions, credit tiers, credit balances and public/credit stock workflows remain separate.

## Implementation files

- `api/direct_sales.php`: pricing, sale creation, payment ledger, Finance verification, version checks, receipt authorization, reservations, handover, returns, refunds, audit and purchased-stock ownership.
- `api/direct-sales-schema.sql`, `database/schema.sql`, `api/config.php`: additive schema and automatic upgrade support for hosts with an older private schema copy.
- `api/marketplace.php`: route integration and protection against removing/renaming products still linked to direct sales.
- `api/reports.php`: separate direct-sale and movement datasets with permission-based financial redaction.
- `api/staff.php`, `api/security.php`, `api/.htaccess`: granular role permissions, configurable upload request allowance and source-file protection.
- `src/DirectSales.jsx`, `src/direct-sales.css`: buyer/product lookup, compact single-page creation, detail actions, private receipt versions, profile history and responsive UI. Reuses `InvoiceAttachment`, its camera flow, `ReceiptPreview` and `PortalOverlay`.
- `src/directSalesModel.js`, `src/directInvoice.js`: pricing previews, filtering, finance aggregation, explicit Excel sheet grains, printable invoices and local PDF download.
- `src/App.jsx`: Customer Orders button, order-type filter, combined workbook download, purchase-profile tab and staff permission labels.
- `src/ReportsWorkspace.jsx`, `src/reportModel.js`: Direct Sales report, Direct Sales Finance section and Products & Stock movement history.
- `.env.production.example`: optional policy, receipt-size and real company settings.

## Additive database migration

The migration creates four InnoDB tables without deleting/backfilling historical orders:

1. `direct_sales`: distinct sale IDs, unique submission key, linked member ID when applicable, buyer contact snapshot, payment/fulfilment states, optimistic version and sale/item/payment/refund/audit snapshots.
2. `direct_sale_stock_movements`: one record per sale/product/movement type, enforced by a unique constraint.
3. `direct_sale_receipts`: permanent private storage references and all receipt versions.
4. `direct_purchase_inventory`: purchased ownership by member/product, independent of credit-financed shop stock.

The normal database initializer runs the additive DDL. Ship `api/direct-sales-schema.sql` with the API even if the production private `schema.sql` is older. The existing database user needs its normal CREATE TABLE privileges. Back up both the database and the existing private receipt directory as part of normal deployment.

## Permissions

Super Admin has all capabilities. Staff roles explicitly receive:

| Permission | Capability |
| --- | --- |
| `admin-orders` | Opens the Customer Orders work area |
| `direct-sales` | Creates sales, collects cash, manages drafts and fulfilment |
| `direct-sales-pricing` | Enters negotiated prices, discounts and custom service charges |
| `direct-sales-approve` | Explicitly approves prices that exceed configured policy thresholds |
| `direct-sales-finance` | Reads private receipt versions, verifies/rejects bank transfers, corrects proof and records actual refunds |
| `entrepreneurs` | Reads linked direct purchases in entrepreneur profiles, without private proof unless separately authorized |
| `reports` | Opens management reports, with the relevant Direct Sales/Finance permissions controlling the new data |

Finance can verify payments without having sale-creation permission. Existing role assignments are not silently expanded.

## Pricing and financial rules

- The server resolves product IDs and prices from the catalogue, checks quantities and calculates all final amounts. Client totals are previews.
- Catalogue totals already contain service components. Those components are removed before selected delivery/packaging charges are applied once. Collection defaults to no delivery; other pricing methods can add selected per-unit charges.
- Discounts apply once to the selected service-adjusted base, never repeatedly to an already discounted price. Editing Final Unit Price selects an all-in custom price and clears previous discounts/service additions.
- Custom prices, discounts and changed service amounts require pricing permission and a reason. Explicit discounts are reported separately from original catalogue totals and negotiated prices.
- Optional `CAMY_DIRECT_MAX_DISCOUNT_PERCENT` (0–100) requires explicit price-approver authorization above that percentage. Explicit discounts use the chosen base; custom prices are compared with Billing Price plus chosen services. An optional product metadata field `directSaleMinimumPrice` enforces an absolute minimum. No minimum or maximum discount is invented when none is configured.
- Price, service and configured company snapshots are saved with the sale. Repricing is allowed only for an unpaid, unreserved draft and records before/after history. Confirmed sale prices remain historical records.
- Billing Price is a selling-price component, not assumed purchase cost. No cost-of-goods, profit, tax rate or tax registration number is invented.
- Cash is recognized only with explicit collection confirmation. Excess tender is change; short collection remains partially paid.
- Bank proof starts Verification Pending and contributes zero received money until Finance explicitly checks bank records. Rejected proof can be corrected and resubmitted. Replacing proof after actual bank verification preserves the confirmed money and flags the corrected proof in history.
- Multiple payments are supported. Payment status and fulfilment status are separate. Closed cancellations/returns do not remain receivables; actual refunds have their own dated ledger.
- Direct-sale revenue is recognized at handover/dispatch and reversed on physical return. Collected cash, verified bank receipts and actual refund cash flows are separate report measures.
- No direct sale enters `shop_orders`, the commission payout queue, sales-based credit eligibility or outstanding credit debt.

## Stock and ownership

All mutations acquire the existing warehouse/global state lock and use database transactions. A unique submission key prevents duplicate sales, and a version check rejects stale or duplicate action submissions.

An optional reservation immediately reduces **available warehouse stock**, as the existing warehouse model represents availability. Cancellation releases that reservation exactly once. Handover of reserved goods records the outgoing movement without deducting availability again. Unreserved handover checks and deducts current availability atomically. Marking Completed, payment verification, receipt correction and refresh never deduct stock.

Only an explicitly confirmed physical return restores warehouse stock. Refund recording never restores stock by itself. Purchased entrepreneur ownership is incremented on handover and decremented on confirmed return, without creating credit debt or credit-financed/public-shop inventory. Catalogue code changes/removals are blocked while a direct-sale relationship still needs those products.

## Receipts, invoices and deployment settings

Receipts reuse the private `receipts` directory. URLs authorize every request; raw file paths are not returned. File type/content and size are checked on the server. All corrected versions remain viewable/downloadable by Finance; failed database saves remove newly staged files and roll back the sale.

`CAMY_DIRECT_RECEIPT_MAX_MB` defaults to 20 MB and supports 1–50 MB. For a 20 MB document, allow at least 32 MB request bodies at the web server/PHP layer because JSON/base64 increases request size. Increase PHP memory appropriately for higher configured limits. Camera capture requires HTTPS or localhost and permission from the browser; file upload remains available when camera access fails.

Invoice headers use saved `companySettings` fields (`name`, `address`, `phone`, `email`, `taxNumber`) or the real `CAMY_COMPANY_*` environment settings shown in `.env.production.example`. Blank settings remain blank. Configure actual company details before issuing production invoices. Invoices are different from payment proof.

PDF download works locally without an external PDF service or new dependency. PDF pages are rasterized to retain Unicode names in browser fonts; text is not selectable. View/Print Invoice uses normal HTML with selectable text and the browser's print/Save as PDF dialog.

## Reports and exports

- Customer Orders has All / Dropshipping / Assisted / Direct Sales type filters. Direct payment and fulfilment filters remain separate from COD order status.
- Direct Sales report supports Today, This Week, This Month, Last Month, custom ranges, buyer type, entrepreneur, payment method/state and fulfilment state.
- Excel includes `Direct Sale Summary` (one row per sale), `Direct Sale Items` (one row per product), `Direct Sale Payments` (one row per payment), and an additional refund sheet. Full sale totals are not repeated on product lines.
- Products & Stock includes direct reservation, outgoing, cancellation release and physical-return movement history. Before/after columns explicitly describe warehouse **availability**.
- Finance Summary keeps Direct Sales separate from COD collections and commission figures. Unverified transfers are excluded from received money.

## Validation

Run:

```text
npm run build
node scripts/run-php.mjs scripts/test-direct-sales.php
node scripts/test-direct-sales-model.mjs
node scripts/review-direct-sales.mjs
node scripts/test-direct-invoice-pdf.mjs
```

The backend test creates a temporary database and private receipt directory, exercises cash/bank/walk-in sales, four-product mixed pricing, partial payments, discounts/approval, receipt corrections, failed uploads/saves, draft edits, reservations, returns/refunds, role restrictions, product relationships and two concurrent last-unit sale attempts, then removes its fixtures.

The browser test starts an isolated PHP/MySQL/Vite session with test accounts. It exercises real HTTP authentication, camera capture/retake, bank verification, handover, persistent receipt correction/download, sales-only receipt denial, profile/report integration, PDF generation and widths 1440/1100/800/390. Test accounts/products are not seeded into the working application database.

Existing invoice correction, ERP API/report, stock workflow, assisted COD creation, dropship payout/credit, credit-policy, report-model and customer-order export regressions also passed. The new real-HTTP suite verifies anonymous receipt denial and sales-only access restrictions.

Two older regression scripts were attempted and failed before reaching Direct Sales:

- `scripts/test-workflow-api.php` inserts a marketplace state row already seeded by `schema.sql`, producing duplicate primary key `1`. Its remaining scenarios target the retired customer portal.
- `scripts/test-staff-auth.php` creates a copied API router without rewriting the newer `notifications.php` include, producing an invalid bootstrap response before the anonymous-access assertion. It also assumes the old built-in staff role creation workflow.

These legacy fixtures were not changed to re-enable retired business flows. Current Direct Sales authorization is covered by the isolated backend and real-HTTP browser tests.

## Scope and remaining operational limits

- Returns currently confirm all items from a sale; item-level partial returns are not included.
- The purchased-stock ownership ledger is distinct from the existing credit/public-shop stock ledger; this flow does not publish purchased goods for online resale.
- Bank verification and actual cash/refund collection remain authorized human confirmations, not bank API integrations.
- Production deployment and real company/policy configuration remain operational steps; this implementation does not deploy itself or send customer emails.


## Compact inline interface

Direct Sale creation now replaces the Customer Orders content in the main workspace. There is no wizard, overlay or new browser window. Buyer selection and compact product rows share the page with payment and totals. Optional discounts, service charges, extra buyer details and approval controls expand only when needed. Sale details use Overview / Products / Payments / History tabs. Camera, payment proof and invoice previews stay inline, with the existing server permissions and financial rules preserved.
