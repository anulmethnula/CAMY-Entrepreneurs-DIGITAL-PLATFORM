# CAMY Current Entrepreneur Flow

Updated: 25 September 2026

## Active system scope

CAMY has two active business sides:

1. **Entrepreneur Portal**
2. **CAMY Admin / authorized staff**

There is no active customer account or public customer-shopping portal. Entrepreneurs find their own clients and enter confirmed client orders into CAMY.

## Phase 1 — Trial drop-shipping

All new entrepreneurs start with drop-shipping.

1. Entrepreneur registers and CAMY Admin approves the account.
2. Entrepreneur finds a client outside the system.
3. Entrepreneur chooses a client selling price. It cannot be below the CAMY catalogue price.
4. Entrepreneur enters the client's name, phone, district, address and optional delivery note.
5. **Client payment is Cash on Delivery only.**
6. CAMY reserves warehouse stock, prepares the parcel and dispatches it.
7. CAMY records courier/tracking information.
8. After successful delivery, CAMY collects the full client COD amount.
9. The system records:
   - **CAMY product value**
   - **Client COD total**
   - **Entrepreneur margin = Client COD total - CAMY product value**
10. CAMY transfers only the entrepreneur margin to the entrepreneur's saved bank account.
11. Admin records the CAMY-to-entrepreneur transfer reference and uploads that transfer receipt.
12. Entrepreneur can see payout status and the CAMY transfer receipt.

### Important payment rule

There is **no client bank-transfer option and no client receipt upload** in the active flow.

Example:

- CAMY product value: Rs. 10,000
- Entrepreneur client price: Rs. 12,500
- Client pays COD: Rs. 12,500
- CAMY keeps: Rs. 10,000
- Entrepreneur margin: Rs. 2,500
- After successful delivery/collection, CAMY transfers Rs. 2,500 to the entrepreneur.

If an already-paid dropship order is later returned, its entrepreneur payout becomes **Reversal required** for Finance/Admin reconciliation.

## Verified sales and Phase 2 eligibility

Credit-tier calculations use the **CAMY product value of successfully delivered orders**, not the entrepreneur's markup.

The CAMY brief defines configurable sales-based credit tiers but does not define one fixed trial duration. Therefore the system uses CAMY Admin's configured first credit milestone as the Phase 2 unlock.

- Below the first configured tier: **Phase 1 · Trial drop-shipping**
- At/above a configured tier: **Phase 2 · Credit eligible**

## Phase 2 — entrepreneur chooses either method

Becoming credit eligible does **not** remove drop-shipping.

A Phase 2 entrepreneur can choose either path whenever they want:

### Option A — Continue drop-shipping

The entrepreneur can keep placing the same COD client orders. CAMY delivers to the client, collects COD, keeps the CAMY product value and transfers the entrepreneur margin.

### Option B — Request physical CAMY stock on credit

1. Entrepreneur opens **Credit stock**.
2. System shows:
   - credit limit
   - current outstanding
   - pending/approved credit commitments
   - available credit
3. Entrepreneur selects CAMY products and sends a credit-stock request.
4. No upfront payment and no receipt are required.
5. CAMY Admin checks eligibility, available credit and warehouse stock.
6. **Approve** reserves the warehouse units but does not yet increase outstanding credit.
7. **Dispatch** moves the units to the entrepreneur's issued inventory and increases their outstanding credit by the request value.
8. Entrepreneur later settles the outstanding credit through the Credit & Settlements flow.
9. CAMY verifies settlements before reducing outstanding credit.

The server blocks requests or dispatches that would exceed the entrepreneur's current credit limit.

## Phase 3 — Credit & settlement tracking

The system tracks:

- credit limit
- credit issued/outstanding
- available credit
- settlement requests
- verified repayments
- entrepreneur drop-ship earnings
- CAMY-to-entrepreneur payouts
- payout references and receipts

## Admin controls

CAMY Admin can manage:

- registrations and entrepreneur profiles
- COD client orders and delivery tracking
- CAMY catalogue and warehouse stock
- entrepreneur margin payouts
- credit tiers
- Phase 2 credit-stock requests
- credit settlements
- reports and user access

## Performance / stability protections

The active implementation includes:

- one shared application state poll instead of duplicate page polling
- 15-second polling only while the browser tab is visible
- immediate refresh when the tab becomes visible again
- database row locking only for write transactions
- bulk payout-ledger hydration instead of per-order N+1 queries
- daily, rather than every-poll, 90-day inactivity maintenance
- indexed order/request/account fields used by frequent database lookups
- database-side credit-limit and stock validation, so UI bypasses cannot over-issue stock or credit
- transactional stock reservation / issue updates

## Key files

- `src/DropshipMarketplace.jsx` — COD dropshipping + optional Phase 2 credit stock
- `src/App.jsx` — active entrepreneur/admin navigation and finance/credit views
- `api/workflow.php` — COD client-order creation and entrepreneur payouts
- `api/marketplace.php` — state, fulfilment, Phase 2 credit stock and credit enforcement
- `api/catalogue.php` — verified CAMY-sales credit calculation
- `database/schema.sql` — MySQL schema and operational indexes
- `scripts/test-dropship-payout.php` — end-to-end COD + payout + Phase 2 credit test
- `src/MarketplaceLegacy.jsx` — migration/history reference only; not active
