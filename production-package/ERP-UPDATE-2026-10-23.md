# CAMY ERP update ? 23 October 2026

Implemented:
- Six management report workspaces with shared filtered previews/Excel columns, detail views and explicit business fields.
- Orders export separates product lines from one-row-per-order totals. Retained amounts are not labelled profit.
- Reports API requires management + reports permission. Finance/bank fields additionally require payouts; credit fields require credit-control or credit-settlements. Admin retains full access.
- Entrepreneur catalogue layout, quantity controls, shared media gallery, fullscreen zoom and original-byte single/ZIP image downloads. Existing videos remain supported; ZIPs include images only.
- Admin shipment cards, explicit edit/save/cancel while Dispatched, copy tracking, Delivered lock, separated returns, and future status history.
- Tracking corrections retain the original dispatch time. Unknown delivery dates are no longer backfilled from order creation dates.

Deploy:
Extract CAMY-ERP-UPDATE-2026-10-23.zip into the active public_html with overwrite enabled.
The existing hosted PHP 8.4 handler is retained.
Keep the existing private/camy.env, private media and production database.
No database reset or clean SQL import is needed. The updated API creates order_status_history additively, including when the host's private schema is older.
No historical transitions are fabricated. Existing dates already present are retained.
This package has NOT been uploaded to hosting.

Validation:
Production build; all PHP modules linted; report model and XLSX export checks; product-cost, credit-policy and workflow checks; isolated report authorization/shipment/history integration; isolated end-to-end payout/credit/settlement/returns flow.
Read-only real-record browser QA at 1440, 1100, 800 and 390px: reports, catalogue, modal fit, zoom, nested Escape handling, shipment edit/cancel and Delivered lock, unchanged PNG/JPEG download bytes, no runtime exceptions.
Original binary ZIP preservation is tested. WebP uses the same original-byte path without re-encoding.
Local counts verified: users 8, entrepreneurs 5, products 87, shop_orders 25.

Data limits retained:
Payout due dates are only shown when recorded; the current backend has no fixed payout deadline.
Product reports show current stock; no historical stock dates or reliable product-cost valuation is invented.
Credit balances are current; settlement date filters use recorded verified/submitted dates, with Joined Date available separately.
Missing historical status events remain unknown.

Local review URL: http://127.0.0.1:8080/ (use IPv4; localhost may resolve to another local site's IPv6 listener).
