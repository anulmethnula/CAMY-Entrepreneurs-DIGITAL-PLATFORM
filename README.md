# CAMY Entrepreneurs Digital Platform

React/Vite portal with a PHP/MySQL API for CAMY-managed dropshipping, private entrepreneur shops, customer orders, commission settlement, and performance-based credit.

## Business model

CAMY owns and stores the products. Entrepreneurs do not need a physical shop or their own stock for the normal selling flow.

1. CAMY activates products with a protected CAMY base price and warehouse quantity.
2. Every approved entrepreneur receives a private storefront link: `/shops?shop=MEMBER-ID`.
3. The entrepreneur chooses which CAMY products to show and sets each customer selling price.
4. A customer using that link sees only that entrepreneur's shop. The application does not expose a directory of competing entrepreneurs.
5. The customer submits one order linked to that entrepreneur and chooses bank transfer to CAMY or cash on delivery.
6. CAMY reserves warehouse stock, approves the order, collects or verifies the customer payment outside the system, dispatches the parcel, and manages returns.
7. The system keeps CAMY's base amount separate from the entrepreneur margin on every item and order.
8. Positive margin becomes payable to the entrepreneur after CAMY records the customer money as collected. Its due date is seven days later.
9. CAMY records the external bank payout and reference. The platform does not transfer money itself.
10. If an entrepreneur sells below CAMY's base price, the shortfall becomes an entrepreneur contribution/outstanding balance so CAMY's amount remains protected.

For example, if the CAMY base price is Rs. 80,000 and the entrepreneur price is Rs. 90,000, CAMY retains Rs. 80,000 and the commission is Rs. 10,000. If the entrepreneur price is Rs. 75,000, the customer pays Rs. 75,000 and the Rs. 5,000 shortfall is recorded against the entrepreneur.

## Payment and fulfilment states

Bank transfer:

`Pending -> Awaiting payment -> Payment review -> Processing -> Dispatched -> Delivered`

Cash on delivery:

`Pending -> Processing -> Dispatched -> Delivered -> COD collected`

Only CAMY Admin or Operations staff can approve payment, dispatch orders, confirm COD collection, manage returns, and record commission payouts. Entrepreneurs can see their own orders, prices, performance, payout status, and credit position but cannot confirm customer money themselves.

Customer payment is external. There is no payment gateway or bank integration. Bank-transfer customers receive only the configured CAMY bank account. COD commission does not become payable until CAMY records the courier/cash remittance reference.

## Credit model

The existing credit module remains available as the post-trial facility described in the project brief:

- Verified delivered sales determine eligibility.
- CAMY Admin configures sales thresholds and credit limits; values are not hardcoded.
- The system tracks issued credit, settlements, and outstanding balances.
- A below-base sale or recovery of an already-paid commission after a return can add to the entrepreneur's outstanding balance.
- Stock-on-credit requests remain a separate optional post-trial facility; they are not required for ordinary dropshipping sales.
- For an approved credit-stock issue, CAMY Admin sets a return deadline (1–365 days) and may edit it later. Physically returned unsold stock is restored to CAMY and reduces the entrepreneur's outstanding balance. Damaged, lost, or non-returned stock remains payable by the entrepreneur and is recorded with an inspection note.

## Roles

- Super Admin: full products, entrepreneurs, rules, orders, finances, and reports access.
- Operations Admin: customer payment review, COD collection, dispatch, returns, and commission settlement.
- Entrepreneur: private shop prices and visibility, own orders, sales, commission, credit, and settlement account.
- Customer: private shop purchase, external payment proof, order tracking, delivery confirmation, returns, favourites, and reviews.

## Local setup

Start MySQL in XAMPP, then run:

```powershell
npm.cmd install
npm.cmd run dev
```

The web app runs at `http://127.0.0.1:8080`; the PHP API runs at `http://127.0.0.1:8000`. Ports 8000 and 8080 must be available.

The API creates missing tables from `database/schema.sql` and adds the current order-economics columns to older installations. Private NIC images, receipts, sessions, and bootstrap credentials live under `private/` and must never be published.

Configure production with `CAMY_DB_HOST`, `CAMY_DB_PORT`, `CAMY_DB_NAME`, `CAMY_DB_USER`, and `CAMY_DB_PASSWORD`. `CAMY_ENV=production` requires a dedicated database user and a non-empty password. Use HTTPS.

## Verification

```powershell
npm.cmd run build
C:\xampp\php\php.exe scripts\test-workflow.php
C:\xampp\php\php.exe scripts\test-workflow-api.php
C:\xampp\php\php.exe scripts\test-staff-auth.php
C:\xampp\php\php.exe scripts\check-database.php
node scripts\test-reports.mjs
```

The API integration test creates and removes an isolated temporary MySQL database.

## Security and reliability notes

- Stock reservation, price validation, shop ownership, payment state changes, and payout eligibility are enforced by the PHP API.
- Checkout uses an idempotency key so a network retry does not duplicate an order.
- Customer, entrepreneur, and staff sessions remain separated.
- Private receipts are served only after ownership or staff authorization checks.
- Administrative writes are audited, sign-in attempts are rate-limited, and staff sessions expire.
- Returns restore CAMY warehouse stock once. A return cancels unpaid commission; if commission was already paid, the recovery is recorded against the entrepreneur.
