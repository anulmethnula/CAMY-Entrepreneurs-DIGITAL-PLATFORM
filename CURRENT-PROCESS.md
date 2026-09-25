# CAMY Current Process — Entrepreneur Managed Dropshipping

## Current active process

The customer is not a system user. The active portal has two roles: CAMY Entrepreneur and CAMY Admin / Operations.

1. The entrepreneur finds and talks to the client outside CAMY (WhatsApp, phone, social media, or in person).
2. The entrepreneur opens **Client orders** and creates an order with the client's name, mobile number, district, delivery address, products, quantities, selling prices, source and notes.
3. Submitting the order reserves the required CAMY warehouse quantity and sends the order to CAMY Operations with status **Pending**.
4. CAMY Admin sees the complete entrepreneur, client, product, CAMY base price, selling price, margin and delivery details.
5. CAMY Admin confirms the order. Status becomes **Processing / packing**.
6. CAMY dispatches the parcel to the entrepreneur's client. A courier tracking number is required before status becomes **Dispatched**.
7. The entrepreneur sees the status, courier and tracking number in the portal. The client does not need a CAMY account.
8. CAMY marks the order **Delivered** after fulfilment. Delivered value counts toward the entrepreneur's verified sales and credit tier.
9. COD collection and entrepreneur margin/commission settlement continue under CAMY control.
10. Rejected or returned orders restore reserved CAMY stock according to the existing workflow.

The Client Orders page refreshes order information every 20 seconds while visible. This is polling-based live status, not a WebSocket connection.

## Credit sensor

The entrepreneur Client Orders page shows a Credit Sensor using the existing CAMY credit figures:

- Limit: current approved credit limit.
- Used: current outstanding/used credit.
- Available: limit minus used.
- Building eligibility: no approved limit yet.
- Healthy: under 60% usage.
- Watch usage: 60% to under 90%.
- High usage: 90% or more.

Delivered sales continue to drive tier eligibility using CAMY Admin's configurable credit thresholds.

## Old process vs current process

| Area | Old process | Current process |
| --- | --- | --- |
| Customer system access | Customer account and private storefront | No customer account or storefront |
| Order creator | Customer | Entrepreneur |
| Sales channel | CAMY storefront | WhatsApp, phone, social media, in person, etc. |
| Order submission | Customer checkout | Entrepreneur enters client order |
| Stock | Shop/customer order flow | CAMY warehouse is reserved when entrepreneur submits |
| Fulfilment | CAMY after customer checkout/payment | CAMY confirms, packs and sends directly to client |
| Delivery visibility | Customer tracked own order | Entrepreneur tracks client's delivery |
| Admin visibility | Customer-shop order details | Full entrepreneur + client + product + margin + delivery details |
| Credit | Delivered sales / tiers | Same tier engine plus visible Credit Sensor |
| Customer UI | Active | Retired from active portal |

Historical customer components and tables may remain in the repository/database to avoid destructive migrations, but customer storefront/account routes are not part of the active application.
