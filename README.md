<p align="center">
  <img src="readme-banner.svg" width="100%" alt="CAMY Entrepreneurs Digital Platform" />
</p>

<p align="center">
  <b>Entrepreneur selling, COD fulfilment, payouts and credit-stock operations in one connected business platform.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react&logoColor=111827" alt="React" />
  <img src="https://img.shields.io/badge/PHP-API-777BB4?style=flat-square&logo=php&logoColor=white" alt="PHP" />
  <img src="https://img.shields.io/badge/MySQL-Database-4479A1?style=flat-square&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/XAMPP-Local-FB7A24?style=flat-square&logo=xampp&logoColor=white" alt="XAMPP" />
</p>

---

## Project Snapshot

| | |
|---|---|
| **Business problem** | CAMY needs one clear workflow for entrepreneur orders, stock, COD collections, payouts and credit stock. |
| **Solution** | A role-based operations platform for CAMY Admin and Entrepreneurs. |
| **Main users** | Entrepreneurs + CAMY Admin. |
| **Key flow** | Sell → Fulfil → Collect COD → Pay entrepreneur → Build credit eligibility. |

## What the Platform Handles

- Entrepreneur product browsing and selling-price control
- Cash-on-Delivery client orders
- Warehouse stock reservation and fulfilment
- Courier and tracking updates
- Entrepreneur profit and payout records
- Credit eligibility, credit-stock requests and settlements
- Server-side stock and credit validation

## Business Workflow

<p align="center">
  <img src="readme-workflow.svg" width="96%" alt="CAMY business workflow from entrepreneur selling to COD payout and credit stock" />
</p>

## Product Context

<div align="center">
<table>
<tr>
<td align="center"><img src="public/products/ac-12000.png" width="145" alt="Air Conditioner" /><br/><b>Air Conditioners</b></td>
<td align="center"><img src="public/products/smart-tv.png" width="145" alt="Smart TV" /><br/><b>Smart TVs</b></td>
<td align="center"><img src="public/products/cookware-set.png" width="145" alt="Cookware" /><br/><b>Cookware</b></td>
<td align="center"><img src="public/products/double-door-fridge.jpeg" width="145" alt="Refrigerator" /><br/><b>Refrigerators</b></td>
</tr>
</table>
</div>

## Core Business Flows

**Drop-shipping**  
`Choose product` → `Set selling price` → `Place COD order` → `CAMY dispatches` → `COD collected` → `Profit paid`

**Credit stock**  
`Request stock` → `Credit + stock check` → `Approve` → `Issue stock` → `Settlement` → `Credit updated`

## Engineering & Business Focus

- Database transactions for important write operations
- Server-side stock and credit checks
- Shared state refresh to reduce duplicate polling
- Operational indexes for common order and credit queries
- Payout-ledger consistency checks
- Public entrepreneur registration with QR support
- Clear separation between entrepreneur actions and admin operations

## What This Project Demonstrates

- Translating a real business model into a structured digital workflow
- Designing around multiple roles, stock movement and payment states
- Connecting operational rules with database-level validation
- Handling COD, profit calculation and credit-stock logic in one platform
- Thinking beyond UI screens to complete process delivery

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | PHP |
| Database | MySQL |
| Local environment | XAMPP |

## Run Locally

```powershell
npm.cmd install
npm.cmd run dev
```

**Local services**
- App: `http://127.0.0.1:8080`
- Registration: `http://127.0.0.1:8080/register`
- API: `http://127.0.0.1:8000`

Useful checks:

```powershell
npm.cmd run db:setup
npm.cmd run db:check
npm.cmd run build
```

> `npm.cmd run db:reset` completely resets the local database and deletes local data.

---

<p align="center"><b>Built around a real operational flow — not only a product catalogue.</b></p>
