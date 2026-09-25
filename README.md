# CAMY Entrepreneurs Digital Platform

CAMY is now an **Entrepreneur + CAMY Admin** dropship operations platform.

There is no active customer portal. Entrepreneurs sell to their own clients, enter those client orders into CAMY, and CAMY Admin handles fulfilment and delivery updates.

## Current business flow

1. CAMY Admin manages the CAMY product catalogue, prices and warehouse stock.
2. An entrepreneur finds and sells to a client outside this system.
3. The entrepreneur opens **New client order** in CAMY.
4. The entrepreneur selects CAMY products, quantity and client selling price.
5. The entrepreneur enters the client's name, Sri Lankan mobile number, district, delivery address and optional notes.
6. CAMY records the order as **Processing** and reserves the required quantity from CAMY warehouse stock.
7. CAMY Admin sees the entrepreneur, client, delivery address, products, CAMY cost, client order value and fulfilment status.
8. CAMY Admin dispatches the parcel and records a required tracking number plus an optional courier.
9. The entrepreneur sees the latest delivery status from the Orders / Delivery tracking page. The order view refreshes periodically while the dropship workspace is open.
10. CAMY Admin marks the order **Delivered** when complete.
11. Delivered sales feed the entrepreneur's verified sales and credit-tier calculation.

Normal fulfilment path:

```text
Entrepreneur creates client order
        ↓
Processing
        ↓
CAMY Admin packs order
        ↓
Dispatched + tracking number
        ↓
Delivered
        ↓
Verified sales + credit tier update
```

CAMY Admin can reject a Processing order when fulfilment cannot continue. Reserved CAMY warehouse stock is restored when a reserved dropship order is rejected or returned.

## Local XAMPP setup

Requirements:

- Windows
- XAMPP installed at `C:\xampp`
- XAMPP MySQL running
- Node.js / npm

The default local database is:

```text
camy_new
```

Database connection defaults are in `api/config.php`:

```text
Host: 127.0.0.1
Port: 3306
Database: camy_new
User: root
Password: empty
```

These defaults match a normal fresh XAMPP installation. Production must use environment variables and a dedicated database account.

### Fresh database

To create the database and apply the complete current schema:

```powershell
npm.cmd run db:setup
```

To deliberately delete the current local `camy_new` database and rebuild it from scratch:

```powershell
npm.cmd run db:reset
```

**Warning:** `db:reset` deletes all data inside the configured local database.

A fresh installation creates an administrator account. When a new temporary password is generated, read it from:

```text
private/bootstrap-credentials.txt
```

The administrator must change the temporary password after signing in.

## Run the project

Start **MySQL** in XAMPP first.

Then:

```powershell
npm.cmd install
npm.cmd run dev
```

Development addresses:

- Web app: `http://127.0.0.1:8080`
- PHP API: `http://127.0.0.1:8000`
- API health: `http://127.0.0.1:8080/api/health`

`npm run dev` verifies MySQL, creates `camy_new` when it is missing, applies `database/schema.sql`, and only then starts the PHP API and Vite.

## VS Code SQL note

`database/schema.sql` is **MySQL/MariaDB SQL**, not Microsoft SQL Server syntax.

The repository workspace disables MSSQL IntelliSense for this schema and recommends MySQL-compatible SQL tooling. If VS Code previously showed hundreds of red errors for valid syntax such as `AUTO_INCREMENT`, `ENUM`, `TINYINT` or `ON UPDATE CURRENT_TIMESTAMP`, reload the VS Code window after pulling the latest `main`.

## Important files

- `src/DropshipMarketplace.jsx` — entrepreneur order creation, tracking and credit sensor
- `src/App.jsx` — entrepreneur/admin application shell
- `api/workflow.php` — dropship order creation and workflow rules
- `api/marketplace.php` — marketplace state and admin fulfilment
- `api/config.php` — MySQL connection and automatic schema initialization
- `database/schema.sql` — database schema
- `scripts/setup-local-db.php` — one-command local database setup/reset
- `CURRENT-DROPSHIP-FLOW.md` — current process reference

`src/MarketplaceLegacy.jsx` is retained only as migration/history reference. It is not imported by the active marketplace module.

## Retired customer portal

The previous public customer-shop workflow has been retired.

- `/shops` is no longer an active application entry point.
- Customer API entry points and the old public marketplace endpoints return a retired-flow response.
- Client name, phone and delivery details are still stored with dropship orders because CAMY needs them to deliver the entrepreneur's order.
- Some legacy database tables/files may remain temporarily for migration compatibility; they are not the active ordering flow.

## Checks

Web build:

```powershell
npm.cmd run build
```

PHP syntax:

```powershell
C:\xampp\php\php.exe -l api\index.php
C:\xampp\php\php.exe -l api\marketplace.php
C:\xampp\php\php.exe -l api\workflow.php
C:\xampp\php\php.exe -l api\config.php
```

Local database setup:

```powershell
npm.cmd run db:setup
```

The current process is documented in `CURRENT-DROPSHIP-FLOW.md`.
