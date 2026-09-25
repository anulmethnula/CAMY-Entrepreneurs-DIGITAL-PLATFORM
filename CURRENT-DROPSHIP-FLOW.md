# CAMY Current Dropship Process

Updated: 25 September 2026

## System scope

CAMY now has two application roles only:

1. Entrepreneur
2. CAMY Admin / authorized staff

There is no customer-facing shopping portal in the active application flow. Entrepreneurs find and communicate with their own clients outside CAMY, then enter confirmed client orders into the CAMY Entrepreneur Panel.

## Entrepreneur flow

1. Sign in to the CAMY Entrepreneur Panel.
2. Open **Products**.
3. Browse the CAMY catalogue.
4. Add the product(s) requested by the entrepreneur's client.
5. Enter the entrepreneur's client selling price for each product.
6. Enter the client's:
   - full name
   - Sri Lankan mobile number
   - district
   - delivery address
   - optional order/delivery note
7. Review:
   - CAMY product cost
   - client order total
   - estimated entrepreneur margin
8. Select **Place order with CAMY**.
9. CAMY records the order as **Processing** and reserves the required CAMY warehouse stock.
10. The entrepreneur can watch order status and delivery information from the panel. The order tracker refreshes automatically every 10 seconds while the order workspace is open.
11. When CAMY marks the order **Delivered**, the order value becomes verified sales for the entrepreneur and the existing credit-tier engine recalculates credit eligibility.

## CAMY Admin flow

1. Sign in to the CAMY Admin Panel.
2. Open **Orders**.
3. View orders submitted by entrepreneurs, including:
   - entrepreneur
   - client name and phone
   - client delivery address
   - products and quantities
   - selling/order total
   - current fulfilment status
4. Prepare the order at CAMY.
5. When dispatching, enter:
   - courier tracking number (required)
   - courier company (optional)
6. Change status from **Processing** to **Dispatched**.
7. The entrepreneur receives the updated status/tracking information through the Entrepreneur Panel.
8. Mark the order **Delivered** when delivery is completed.
9. Delivered sales feed the entrepreneur sales/credit calculation.

## Order status flow

```
Entrepreneur confirms client order
          |
          v
      Processing
          |
          | CAMY packs order
          v
      Dispatched
          |
          | tracking number visible to entrepreneur
          v
       Delivered
          |
          v
Verified sales + credit-tier recalculation
```

## Credit sensor

The existing CAMY credit-tier configuration is retained.

The Entrepreneur Panel shows:

- verified delivered sales
- current credit limit
- remaining verified sales needed to reach the next configured credit tier

Only successfully delivered orders count as verified sales.

## Customer portal

The previous public `/shops` customer entry point is no longer part of the active application process. Requests to the old customer-facing route are returned to the main CAMY application.

The former marketplace implementation is preserved internally in `src/MarketplaceLegacy.jsx` as a migration backup and is not used for the active entrepreneur product/order screen.

## Active implementation files

- `src/DropshipMarketplace.jsx` — entrepreneur dropship ordering, credit sensor and live order updates
- `src/Marketplace.jsx` — routes existing App imports to the new dropship components
- `src/MarketplaceLegacy.jsx` — preserved previous marketplace code
- `src/main.jsx` — removes the public customer entry route
- `api/workflow.php` — saves entrepreneur-submitted dropship orders
