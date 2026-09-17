# CAMY Dropshipping Flow Review

## Implemented controls

- CAMY warehouse stock is the single availability source for ordinary entrepreneur sales.
- Each entrepreneur has a shareable private shop link; customers are not shown other entrepreneur shops.
- Entrepreneur price overrides are stored per product and may be above or below CAMY's protected base price.
- Checkout freezes customer price, CAMY base amount, commission/contribution, entrepreneur identity, and payment method.
- Checkout is idempotent and atomically reserves CAMY warehouse stock.
- Customer bank payments use CAMY's configured account. Customer receipts, bank verification, dispatch, COD collection, returns, and payouts are CAMY staff actions.
- Positive commission becomes payable only after CAMY records money collected, with a seven-day due date.
- Commission payouts require the entrepreneur's settlement account and an external bank reference.
- Below-base sales create an entrepreneur contribution balance. A return cancels unpaid commission or records recovery if commission was already paid.
- Verified delivered sales continue to drive configurable credit-tier eligibility.

## Verification coverage

- Vite production build.
- Workflow unit checks for bank-transfer and COD state transitions and warehouse reservation/release.
- Isolated MySQL API integration covering private listing generation, CAMY-only order control, bank transfer, COD, seven-day commission settlement, below-base contribution, and duplicate COD collection protection.

## Deployment note

The application records external money movement but does not integrate a payment gateway, bank API, courier API, WhatsApp, or SMS. Production rollout still requires real CAMY bank details, operational user accounts, HTTPS, backups, and user acceptance testing with CAMY staff and entrepreneurs.
