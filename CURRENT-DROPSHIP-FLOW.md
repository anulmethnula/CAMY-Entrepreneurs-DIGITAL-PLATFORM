# CAMY Current Entrepreneur Flow

Updated: 25 September 2026

## System scope

The active CAMY application has two business sides:

1. **Entrepreneur Portal**
2. **CAMY Admin / authorized staff**

There is no active customer account or customer shopping portal. Entrepreneurs find and communicate with their own clients, then enter confirmed client orders into CAMY.

## Phase 1 — Trial drop-shipping

1. The entrepreneur registers and CAMY Admin approves the account.
2. The entrepreneur browses the CAMY catalogue and takes an order from their own client.
3. The entrepreneur chooses the client selling price. The selling price must cover the CAMY product price.
4. CAMY records three separate money values:
   - **CAMY product value** — what CAMY must keep for the product.
   - **Client total** — what the client will pay.
   - **Entrepreneur margin** — client total minus CAMY product value.
5. The entrepreneur enters the client's name, phone, district, address and optional note.
6. The entrepreneur chooses how the client will pay CAMY:
   - **Cash on delivery** — CAMY / delivery collects the full client amount after successful delivery.
   - **Bank transfer to CAMY** — the entrepreneur uploads the client's bank payment receipt and reference with the order.
7. CAMY reserves warehouse stock and processes the order.
8. Admin adds courier information and dispatches it.
9. After successful delivery, the system marks the client money as collected by CAMY.
10. The entrepreneur margin enters **Pending transfer**.
11. CAMY transfers only the entrepreneur margin to the entrepreneur's saved bank account.
12. Admin records the bank transfer reference and uploads the CAMY-to-entrepreneur transfer receipt.
13. The entrepreneur can see the payout status and receipt in the portal.

Example:

- CAMY product price: Rs. 10,000
- Entrepreneur sells to client for: Rs. 12,500
- CAMY keeps: Rs. 10,000
- Entrepreneur margin: Rs. 2,500
- After delivery and collection, CAMY transfers Rs. 2,500 to the entrepreneur.

If a successfully paid order is later returned, the system marks the payout as **Reversal required** so Finance/Admin can reconcile it instead of silently losing the money trail.

## Verified sales and trial completion

For credit-tier calculations, **verified sales use the CAMY product value of successfully delivered orders**, not the entrepreneur's markup. This prevents an entrepreneur from unlocking extra credit only by setting an unusually high client selling price.

The system uses the first admin-configured sales/credit tier as the trial-completion milestone:

- Below the first tier: **Phase 1 · Trial drop-shipping**
- Once a configured credit tier is reached: **Phase 2 · Credit-based stock / Credit eligible**
- Credit use and repayments are tracked in the existing **Credit & Settlement** module.

The requirements brief does not define a fixed number of trial days, so the transition is controlled by CAMY's configurable sales-tier rules instead of a hardcoded duration.

## CAMY Admin order flow

Admin can see for each dropship order:

- entrepreneur
- client details
- products and quantities
- CAMY price per product
- entrepreneur client selling price
- client total
- CAMY product value
- entrepreneur margin
- client payment method
- client bank receipt/reference where applicable
- fulfilment and courier status
- payout status
- CAMY-to-entrepreneur transfer reference and receipt

Order fulfilment remains:

```
Entrepreneur submits client order
          |
          v
      Processing
          |
          v
      Dispatched
          |
          v
       Delivered
          |
          +--> client money collected by CAMY
          |
          +--> entrepreneur margin pending transfer
          |
          v
 CAMY transfers margin
          |
          v
 Payout receipt recorded
```

## Credit management

Credit tiers remain configurable by CAMY Admin.

The platform displays:

- verified CAMY sales
- current program phase
- current credit limit
- next sales milestone
- credit in use
- available credit
- credit settlement history
- entrepreneur margin earned
- margin waiting for CAMY transfer
- completed CAMY margin payouts

## Record keeping

Financial payout records are stored separately in the `entrepreneur_payouts` ledger. Order records also retain the money-flow status for the UI and reporting.

The payout ledger records:

- order ID
- entrepreneur member ID
- client payment method
- client total
- CAMY product value
- entrepreneur payout amount
- client bank reference/receipt when applicable
- collection status
- payout status
- CAMY transfer reference/receipt
- collection date
- payout date
- admin who recorded the payout

## Active implementation files

- `src/DropshipMarketplace.jsx` — client-order entry, custom selling prices, client payment method, entrepreneur earnings and payout history
- `src/App.jsx` — admin order finance/payout controls, entrepreneur Credit & Earnings view
- `api/workflow.php` — dropship order creation, client payment proof and post-delivery payout recording
- `api/marketplace.php` — fulfilment status, collection state, payout state and credit recalculation
- `api/catalogue.php` — verified CAMY-sales based credit calculation
- `database/schema.sql` — relational entrepreneur payout ledger
- `src/MarketplaceLegacy.jsx` — preserved old marketplace implementation only; not active
