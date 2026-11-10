# CAMY ERP update v2 - Part 4 included

This ZIP combines Parts 1-3 with Part 4, Admin > Customer Orders > Download Excel.

Part 4:
- Order Summary: one row per visible order, full recorded financial totals, product summary, customer and delivery details.
- Order Items: one row per recorded product line, historical client/CAMY prices, numeric quantity, line totals and margins, and recorded delivery charges.
- Export Summary: active filters, generated time, record/unit counts and safely separated all-status versus delivered-only values.
- Exactly the same filtered/sorted array drives the on-screen directory and export. Search includes individual recorded product names and codes.
- Current catalogue data is used only for missing product descriptions; historical prices are never substituted.
- Unknown prices remain blank. Orders without recorded item lines are counted explicitly; product lines are not fabricated.
- LKR currency, typed dates and numbers, text IDs/phones/tracking/references, wrapped cells, frozen headers and autofilters.
- No database or business-flow changes in Part 4.

Validation:
Production build passed. Existing report model and XLSX tests passed.
Dedicated tests covered all/status/date/search/combined filters, one/two/five products, historical prices, safe totals, identifiers, no secret fields, and XLSX parsing.
Read-only browser tests clicked the actual Download Excel button and parsed each resulting workbook. Exact order IDs and item counts matched the visible directory for All, Delivered, Processing, Returned, Cancelled, Today, Last 7 days, This month, Custom range, Search, and combined filters.
Directory checked at 1440/1100/800/390px without horizontal overflow or browser exceptions.

Deploy:
Extract CAMY-ERP-UPDATE-v2-2026-10-23.zip into the active public_html with overwrite enabled.
Keep the existing private configuration, media and database. Do not import the clean SQL.
The package retains the hosted PHP 8.4 handler and the additive status-history upgrade from Parts 1-3.
No upload to hosting has been performed.
