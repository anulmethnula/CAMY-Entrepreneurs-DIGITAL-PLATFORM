# CAMY Entrepreneurs Digital Platform

React/Vite portal with a PHP/MySQL API for CAMY-managed entrepreneur sales, client-order fulfilment, delivery tracking, commission settlement, and performance-based credit.

## Active business model

The customer is **not a system user** in the current process. The active application is for CAMY Entrepreneurs and CAMY Admin / Operations.

1. CAMY manages the product catalogue, protected CAMY base prices, and warehouse quantities.
2. An approved entrepreneur finds clients outside the platform through WhatsApp, phone, social media, in-person selling, or another channel.
3. The entrepreneur opens **Client orders** and records the client's name, mobile number, district, delivery address, products, quantities, selling prices, source, reference, and delivery notes.
4. Submitting the order immediately creates a CAMY Operations order and reserves the required CAMY warehouse stock.
5. CAMY Admin can see the full entrepreneur, client, product, price, margin, notes, and fulfilment information.
6. CAMY Admin confirms the order and prepares the products. The order moves from **Pending** to **Processing**.
7. CAMY dispatches the parcel directly to the entrepreneur's client. A courier tracking number is required before the order can become **Dispatched**.
8. The entrepreneur sees the order status, courier, tracking number, and update history in the portal. The Client Orders page auto-refreshes every 20 seconds while visible.
9. CAMY marks successful fulfilment as **Delivered**. Delivered order value counts toward verified sales and CAMY credit-tier eligibility.
10. Rejected or returned orders restore reserved CAMY warehouse stock according to the existing workflow.

The 20-second refresh is polling-based live status, not a WebSocket connection.

## Order states

Current entrepreneur-entered client-order flow:

`Pending -> Processing -> Dispatched -> Delivered`

Other existing terminal/exception states remain available where applicable:

- `Rejected`
- `Returned`

Only CAMY Admin / Operations controls confirmation, dispatch, delivery completion, COD collection, returns, and financial settlement.

## Order economics

Every direct client order stores:

- Client selling total
- Protected CAMY base amount
- Entrepreneur margin or below-base contribution
- Payment / COD status
- Commission status and settlement information
- Courier and tracking information
- Status update history

The customer does not log in to CAMY and does not place an order through a CAMY storefront.

## Credit model and Credit Sensor

Delivered sales continue to drive configurable CAMY credit tiers.

The entrepreneur's **Credit Sensor** shows:

- **Limit** — approved CAMY credit limit
- **Used** — current used/outstanding credit
- **Available** — limit minus used
- **Building eligibility** — no approved limit yet
- **Healthy** — under 60% usage
- **Watch usage** — 60% to under 90%
- **High usage** — 90% or more

CAMY Admin still controls credit thresholds, limits, settlements, and the optional stock-on-credit workflow. Credit-stock return deadlines remain configurable, and damaged/lost/non-returned stock can remain payable.

## Roles

- **Super Admin** — full access to entrepreneurs, client orders, products, stock requests, credit, users, and reports.
- **Operations / permitted staff** — access according to assigned permissions, including fulfilment and delivery management.
- **Entrepreneur** — creates client orders, monitors CAMY fulfilment/tracking, sees growth, credit, and profile information.
- **Customer** — no CAMY account or active customer-facing portal in the current process.

Historical customer components/tables are retained in the repository/database to avoid destructive migrations, but customer account/storefront routes are retired from the active workflow.

## Key current files

- `src/DirectOrders.jsx` — entrepreneur Client Orders workspace, order entry, tracking list, Credit Sensor.
- `src/direct-orders.css` — Client Orders responsive UI.
- `api/marketplace.php` — direct-order API, stock reservation, order state/history integration.
- `src/Workflow.jsx` — CAMY fulfilment controls and courier tracking.
- `CURRENT-PROCESS.md` — current process and old-vs-new comparison.

## Local setup

Start MySQL in XAMPP, then run:

```powershell
npm.cmd install
npm.cmd run dev
```

The project is configured for the Vite frontend and PHP API used by this repository. Make sure MySQL is running before testing authenticated workflows.

## Useful scripts

- `npm run dev` — `node scripts/dev.mjs`
- `npm run web` — `vite`
- `npm run api` — `C:\xampp\php\php.exe -S 127.0.0.1:8000 -t api api/index.php`
- `npm run build` — `vite build`
- `npm run preview` — `vite preview`

For the PHP/API checks already included in the repository, also use the scripts under `scripts/` with your XAMPP PHP executable as documented in the project.

## Branch workflow

The current process is implemented on:

`feature/camy-dropshipping-flow`

To update an existing local clone:

```powershell
git fetch origin
git switch feature/camy-dropshipping-flow
git pull origin feature/camy-dropshipping-flow
npm.cmd install
npm.cmd run dev
```

Review and test this branch before merging it into `main`.
