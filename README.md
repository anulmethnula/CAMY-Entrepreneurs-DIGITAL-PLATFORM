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
10. Successfully delivered CAMY product value feeds credit eligibility.

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
- PHP API: `http://127.0.0.1:8000`
- API health through Vite: `http://127.0.0.1:8080/api/health`

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
