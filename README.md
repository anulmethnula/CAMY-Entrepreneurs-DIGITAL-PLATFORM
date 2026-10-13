<div align="center">

# CAMY Entrepreneurs Digital Platform

**A simple digital platform for CAMY Admin and Entrepreneurs to manage selling, COD orders, fulfilment, payouts, and credit stock.**

![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=flat-square&logo=vite&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-API-777BB4?style=flat-square&logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=flat-square&logo=mysql&logoColor=white)

</div>

---

## 📌 About the Platform

CAMY is an **Entrepreneur + Admin operations platform**.

Entrepreneurs sell CAMY products to their own clients, while CAMY manages the operational side such as stock, COD orders, courier tracking, payouts, and credit-stock requests.

> There is no active public customer portal. Entrepreneurs manage their own clients through the system.

---

## ✨ Main Features

### 👤 Entrepreneur
- Browse CAMY products
- Set own client selling price
- Place COD orders
- Track order progress
- View earnings and payouts
- Request credit stock

### 🛡️ CAMY Admin
- Manage entrepreneurs
- Manage products and stock
- Review and update orders
- Add courier and tracking details
- Record entrepreneur payouts
- Manage credit eligibility and settlements

---

## 🔄 Business Flow

### Drop-shipping

`Select Product` → `Set Selling Price` → `Place COD Order` → `CAMY Dispatches` → `Customer Pays` → `Entrepreneur Gets Profit`

### Credit Stock

`Request Credit Stock` → `CAMY Reviews` → `Approved` → `Stock Issued` → `Entrepreneur Settles Later`

---

## 🛍️ Products

<div align="center">
<table>
<tr>
<td align="center"><img src="public/products/ac-12000.png" width="145" alt="Air Conditioner"><br><b>Air Conditioners</b></td>
<td align="center"><img src="public/products/smart-tv.png" width="145" alt="Smart TV"><br><b>Smart TVs</b></td>
<td align="center"><img src="public/products/cookware-set.png" width="145" alt="Cookware"><br><b>Cookware</b></td>
<td align="center"><img src="public/products/double-door-fridge.jpeg" width="145" alt="Refrigerator"><br><b>Refrigerators</b></td>
</tr>
</table>
</div>

---

## 🛠️ Tech Stack

| Area | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | PHP |
| Database | MySQL |
| Local Environment | XAMPP |

---

## 💻 Run Locally

### Requirements
- Windows
- XAMPP
- MySQL running
- Node.js + npm

### Install and start

```powershell
npm.cmd install
npm.cmd run dev
```

### Local URLs

- Web App: `http://127.0.0.1:8080`
- Registration: `http://127.0.0.1:8080/register`
- PHP API: `http://127.0.0.1:8000`

---

## 🗄️ Database

Default local database:

```text
Host: 127.0.0.1
Port: 3306
Database: camy_new
User: root
Password: empty
```

Useful commands:

```powershell
npm.cmd run db:setup
npm.cmd run db:check
```

To completely reset the local database:

```powershell
npm.cmd run db:reset
```

> ⚠️ `db:reset` deletes existing local data.

---

## 📁 Main Files

- `src/DropshipMarketplace.jsx` — drop-shipping and credit stock
- `src/App.jsx` — main application
- `api/workflow.php` — COD and payout workflow
- `api/marketplace.php` — marketplace and fulfilment logic
- `api/config.php` — database connection and migrations
- `database/schema.sql` — MySQL schema

---

<div align="center">

### CAMY Entrepreneurs Digital Platform 🚀

**Sell • Manage • Track • Earn**

</div>
