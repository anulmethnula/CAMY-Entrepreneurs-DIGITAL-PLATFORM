# CAMY production deployment on cPanel

This package targets `https://camymarket.com` with Apache, PHP, and MariaDB/MySQL. The package is split into `public_html` (web-accessible) and `private` (never web-accessible).

## 1. Server requirements

- PHP 8.1 or newer (PHP 8.2/8.3 recommended).
- MariaDB 10.4+ or MySQL 8.
- PHP extensions: `pdo_mysql`, `mbstring`, `json`, `fileinfo`, `openssl`, and `session`.
- Apache modules: `mod_rewrite` and `mod_headers`.
- A valid SSL certificate for `camymarket.com` and HTTPS redirection enabled in cPanel.

## 2. Back up before deployment

Back up any existing `public_html`, private application folder, and production database. Do not import the clean SQL into a database that contains data you need to keep.

## 3. Create the database

1. Open **cPanel > MySQL Databases**.
2. Create a new database. cPanel normally prefixes its name, for example `camymarket_camy`.
3. Create a dedicated database user with a long random password.
4. Add that user to the new database.
5. Select **ALL PRIVILEGES** and save.
6. Record the exact prefixed database and user names for `camy.env`.

## 4. Import the clean database

1. Open **cPanel > phpMyAdmin**.
2. Select the newly created empty database.
3. Choose **Import** and upload `camy_production_clean.sql` from the package root.
4. Confirm the import finishes without errors.
5. Confirm there are 87 products, 7 credit tiers, and zero users/orders/entrepreneurs. The final SQL verification result `private_or_transaction_rows` must be `0`.

The first administrator is intentionally not stored in this SQL file.

## 5. Upload files

1. Upload the *contents* of `production-package/public_html/` into `/home/camymarket/public_html/`.
2. Upload the *contents* of `production-package/private/` into `/home/camymarket/private/`.
3. Do not put `camy.env`, `schema.sql`, sessions, NIC files, receipts, backups, or uploaded product media inside `public_html`.
4. Do not upload the project source, `node_modules`, `.git`, tests, logs, screenshots, or local SQL backups.

Expected layout:

```text
/home/camymarket/
  public_html/
    .htaccess
    index.html
    assets/
    products/
    api/
  private/
    camy.env
    schema.sql
    catalogue/
    product-media/
    nic/
    receipts/
    sessions/
```

## 6. Configure the application

1. In `/home/camymarket/private`, copy `camy.env.example` to `camy.env`.
2. Enter the exact cPanel-prefixed `DB_NAME` and `DB_USER` and the database password.
3. Set `CAMY_BOOTSTRAP_PASSWORD` to a unique temporary password of at least 12 characters. Use letters, numbers, and symbols.
4. Keep `CAMY_ENV=production`.
5. Never place `camy.env` in Git or `public_html`.

The initial administrator created on the first API request is:

- Email: `admin@camy.lk`
- Role: `admin`
- Password: the temporary `CAMY_BOOTSTRAP_PASSWORD`
- Mandatory password change: enabled

After successfully changing the administrator password, remove `CAMY_BOOTSTRAP_PASSWORD` from `camy.env`. It is only needed while the `users` table is empty.

## 7. Permissions

- Directories: normally `0755`; use `0700` for `/home/camymarket/private` when supported by the hosting account.
- Public files: `0644`.
- `/home/camymarket/private/camy.env`: `0600` where supported.
- PHP must be able to create/write files under private `sessions`, `nic`, `receipts`, and `product-media`.
- Never use `0777` unless the host explicitly requires it and no safer permission works.

## 8. Routing

The root `.htaccess` processes routes in this order:

1. `/api` and `/api/*` are sent to `api/index.php`.
2. Existing files and directories are served normally.
3. Other paths are sent to React `index.html`, allowing `/login`, `/register`, and other React routes to work after refresh.

The API `.htaccess` routes API paths to `index.php` and denies direct web access to internal PHP modules. Private storage is outside `public_html` and files are returned only through authenticated PHP endpoints where required.

## 9. Verification checklist

1. Visit `https://camymarket.com/` and confirm the marketplace loads.
2. Directly open and refresh `https://camymarket.com/login` and `https://camymarket.com/register`.
3. Open `https://camymarket.com/api/health`; expect JSON with `"ok":true`.
4. Sign in as `admin@camy.lk` with the temporary bootstrap password and immediately set a new password.
5. Confirm the catalogue shows 87 products and product images load, including uploaded product media.
6. Create a temporary entrepreneur registration, verify NIC upload/retrieval from the admin screen, then remove the test record/file before launch if it is not needed.
7. Test an order from creation through the admin order view.
8. Test a receipt or invoice upload and verify it is accessible only to an authorized user.
9. Confirm `http://camymarket.com` redirects to HTTPS and the browser shows a valid certificate.
10. Confirm session cookies are marked `Secure`, `HttpOnly`, and `SameSite=Lax` in browser developer tools.
11. Try requesting `/private/`, `/.env`, and `/camy_production_clean.sql`; all must be unavailable.

## 10. Troubleshooting

- A 500 response on the first API request usually means `camy.env` is missing, has incorrect cPanel-prefixed database names, lacks `CAMY_BOOTSTRAP_PASSWORD`, or PHP cannot read the private directory.
- A React-route 404 normally means `.htaccess` was not uploaded or `mod_rewrite`/`AllowOverride` is disabled.
- An API response containing HTML normally means the root API rewrite is missing.
- Upload failures usually mean PHP `post_max_size`/`upload_max_filesize` or private-directory permissions are too restrictive. The application accepts encoded uploads up to its documented endpoint limits.
