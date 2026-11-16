# CAMY Entrepreneurs Digital Platform

CAMY is an **Entrepreneur + CAMY Admin** operations platform.

There is no active customer portal. Entrepreneurs sell to their own clients and use CAMY in two ways:

- **Drop-shipping:** always available; client pays Cash on Delivery.
- **Credit stock:** unlocks after the entrepreneur reaches a CAMY-configured credit tier and remains optional.

## Current business flow

### Drop-shipping

1. Entrepreneur chooses CAMY products and sets their own client selling price.
2. Entrepreneur enters client delivery details.
3. The order is **Cash on Delivery only**. There is no client bank-transfer or client-receipt upload.
4. CAMY reserves warehouse stock, prepares and dispatches the parcel.
5. CAMY records courier/tracking information.
6. After successful delivery CAMY collects the full COD amount.
7. CAMY keeps the CAMY catalogue value.
8. The remaining margin is transferred to the entrepreneur's saved bank account.
9. Admin records the CAMY-to-entrepreneur transfer reference and receipt.
10. Successfully delivered product selling value (selling price × quantity, excluding delivery charges) feeds credit eligibility; profit does not.

### Phase 2 credit stock

Once credit eligible, the entrepreneur can **still use drop-shipping** and can also choose **Credit stock**.

Credit-stock flow:

```text
Entrepreneur sends credit-stock request
        ↓
CAMY Admin checks credit + warehouse stock
        ↓
Approved → stock reserved
        ↓
Dispatched → stock issued to entrepreneur
        ↓
Outstanding CAMY credit increases
        ↓
Entrepreneur submits settlement
        ↓
CAMY verifies settlement
        ↓
Outstanding credit decreases
```

No upfront payment or stock-purchase receipt is required for the Phase 2 credit request.

Multiple credit-stock orders may remain unpaid as long as their combined outstanding value stays within the entrepreneur's credit limit. Tier 1 has 21 days to settle each order and higher tiers have 10 days. Entrepreneurs may request extra time; CAMY Admin approves or rejects the requested deadline. An unpaid order does not hide the catalogue or prevent a new request from reaching CAMY Admin.

## Local XAMPP setup

Requirements:

- Windows
- XAMPP
- XAMPP MySQL running
- Node.js / npm

CAMY auto-detects PHP from PATH and common XAMPP folders on available Windows drives. Your local XAMPP does **not** need to be installed under `C:\xampp`.

Default local database:

```text
Host: 127.0.0.1
Port: 3306
Database: camy_new
User: root
Password: empty
```

For a custom XAMPP folder, set PHP explicitly for the current PowerShell session, for example:

```powershell
$env:CAMY_PHP_PATH="D:\xammp\php\php.exe"
```

Verify PHP:

```powershell
npm.cmd run php:version
```

## Run the project

Start **MySQL** in XAMPP, then:

```powershell
npm.cmd install
npm.cmd run dev
```

Development addresses:

- Web app: `http://127.0.0.1:8080`
- Public entrepreneur registration: `http://127.0.0.1:8080/register`
- PHP API: `http://127.0.0.1:8001`
- API health through Vite: `http://127.0.0.1:8080/api/health`

For a deployed site, set `VITE_PUBLIC_URL` to the public CAMY origin before building. The admin registration QR code and copied registration link use this value, for example:

```powershell
$env:VITE_PUBLIC_URL="https://camy.example.com"
npm.cmd run build
```

Do not share a QR containing `localhost` or `127.0.0.1`; those addresses only work on the computer running CAMY.

`npm run dev` checks MySQL, creates `camy_new` when missing, applies the current schema/migrations and then starts PHP + Vite.

## Database setup

Create/apply the local database schema without deleting existing records:

```powershell
npm.cmd run db:setup
```

To deliberately destroy and rebuild the configured local database:

```powershell
npm.cmd run db:reset
```

**Warning:** `db:reset` deletes all data. Do not use it for normal updates.

### Production legacy-table cleanup

After backing up the full hosted database, run the versioned cleanup once:

```powershell
npm.cmd run db:cleanup
```

The cleanup targets only retired order tables and the retired customer-account
tables. It writes a restorable SQL backup to
`private/database-backups/` before dropping anything. If any target contains
records, the command creates the backup and stops without deleting tables. Review
that backup before deliberately rerunning with:

```powershell
npm.cmd run db:cleanup -- --allow-data
```

The current `customer_order_groups`, `shop_orders`, `shop_order_items`,
`entrepreneur_payouts`, stock, security, and marketplace tables are active and
are not cleanup targets.

A fresh database may generate temporary admin credentials in:

```text
private/bootstrap-credentials.txt
```

## Performance / stability

The active system uses:

- visible-tab-only state polling
- one shared state refresh rather than duplicate page polling
- write-only database row locking
- bulk payout-ledger hydration
- once-daily inactive-account maintenance
- operational indexes for common entrepreneur/order/credit queries
- database transactions and server-side stock/credit validation

## Checks

Non-destructive local database health check:

```powershell
npm.cmd run db:check
```

This checks required tables, operational indexes, active credit commitments, dropship payout-ledger consistency and other critical database invariants without deleting records.

Frontend build:

```powershell
npm.cmd run build
```

PHP detection:

```powershell
npm.cmd run php:version
```

The GitHub quality workflow also checks React build, PHP syntax, a clean MySQL schema/bootstrap and the end-to-end COD + entrepreneur payout + Phase 2 credit-stock flow.

## Important files

- `src/DropshipMarketplace.jsx` — COD client orders and Phase 2 credit stock
- `src/App.jsx` — entrepreneur/admin application shell
- `api/workflow.php` — COD order + payout workflow
- `api/marketplace.php` — state, fulfilment and Phase 2 credit stock
- `api/config.php` — database connection and automatic migrations
- `database/schema.sql` — MySQL schema
- `scripts/test-dropship-payout.php` — end-to-end business-flow integration test
- `CURRENT-DROPSHIP-FLOW.md` — current process reference

The old public customer marketplace and `src/MarketplaceLegacy.jsx` are retained only for migration/history compatibility and are not part of the active ordering flow.

Viewer-only access: in **Users & Access**, choose **Add user**, enter the person's name and email, and select **Viewer**. The system generates a temporary password and requires a password change on first sign-in. Existing staff can also be reassigned to Viewer. This built-in role can browse operational pages and reports but cannot create, update, upload, approve, or delete business records. The API enforces read-only access on every route. Viewers may change their own password and sign out; staff account management remains Super Admin-only.

Customer orders now shows COD, assisted COD and direct sales in one filtered table. The Excel export starts with the same filtered sales summary. Super Admins can correct buyer details, sale date, product quantities/prices and direct payment entries, or permanently delete a mistaken sale after entering a reason and the exact sale ID. Corrections use a concurrency token; stock, entrepreneur totals and report data update transactionally. Deleted sales and their related database rows and receipt files are removed. A correction to a paid commission flags finance reconciliation and preserves the actual transfer amount. Viewer accounts cannot edit or delete sales.

Direct sale entry starts with item selection. Packaging and delivery charges are visible checkboxes (included initially); unticking removes the chosen charge without adding it twice. Per-item discounts show the original and final unit prices. Printed and downloaded invoices use the official red CAMY logo and the Wellawatte/Supun Arcade address, with stored sale prices, a simple product table, discount totals and page numbers for PDF exports.

Direct sale entry no longer displays More price options or a separate Price approval section. Authorized price approval follows the signed-in role during save. Receipt upload is optional for direct-sale bank payments; a reference is required and payments remain pending until Finance verifies them. Uploaded documents are still validated when supplied. Other payment workflows retain their existing requirements.

Direct-sale details use clear received/pending/cancelled labels instead of exposing Not released as the main status. The overview focuses on payments and cancellation. Goods collection/delivery controls remain available in a collapsed section; cash receipt and item collection still update independently so stock is not reduced just because money was received.
