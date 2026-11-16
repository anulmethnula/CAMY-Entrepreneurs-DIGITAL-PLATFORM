"""Create a cPanel update ZIP from the current production build and API only."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
OUTPUT = ROOT / 'production-package' / 'CAMY-HOSTING-UPDATE-2026-11-12-v7.zip'
REQUIRED = {'index.html', 'register.html', '.htaccess', 'sw.js', 'site.webmanifest', 'api/index.php', 'api/config.php', 'api/direct_sales.php', 'api/sales_corrections.php', 'api/direct-sales-schema.sql', 'api/.htaccess'}

instructions = '''CAMY HOSTING UPDATE - 12 NOVEMBER 2026

FOR THE EXISTING camymarket.com INSTALLATION

NEW: Direct-sale details now clearly show Cash received, Payment received,
Payment pending, or Order cancelled / returned. Payment and cancellation
actions stay on the overview. Item collection/delivery controls are tucked
into a separate collapsed section, preserving accurate stock updates.

NEW: Removed More price options and Price approval from the direct-sale form.
Receipt uploads are optional for direct bank payments (initial and later
payments). The transfer reference is retained; Finance verifies bank payments
whether or not an attachment was supplied. Optional uploads and camera remain
available. Existing stored prices, receipts and approval permissions are kept.

FIX: A blank or cleared optional discount now means zero. Negative/invalid
discounts still fail validation and identify the affected product.

1. Back up the existing public_html, private folder and database.
2. Upload CAMY-HOSTING-UPDATE-2026-11-12-v7.zip into the active public_html.
3. Extract the ZIP there and allow existing files to be overwritten.
   index.html, assets/ and api/ must be directly inside public_html.
4. Keep the existing private/camy.env and all private uploads unchanged.
5. Open the website and refresh. Sign in as Super Admin.
6. Open Users & Access > Add user, enter name/email and select Viewer.
7. Share the generated temporary password; first sign-in requires a new password.
8. Open Customer orders > New Direct Sale. Choose items first, then the buyer.
   Packaging and delivery checkboxes are visible on every selected item.
   Untick either to remove that charge. Enter any discount per item to see
   the original and final discounted unit price immediately.
   Print/download invoices now include the official red CAMY logo and:
   56 Galle Road, Wellawatte, Colombo 06, Sri Lanka
   (M1, Supun Arcade Building).
   COD, assisted orders and direct sales still share one compact polished table.
   COD rows use Manage and retain their approval, dispatch, delivery and
   commission statuses. Direct sale rows show Direct sale plus the actual
   payment status, such as Paid. Viewer accounts keep View-only actions.
9. Filter by sale type, customer type, payment method/status, fulfilment, search or dates.
10. Super Admin can Edit recorded customer/date/products/quantities/prices/payments.
11. Delete permanently removes the selected sale and related database/report rows.
    Enter a reason and type the exact sale ID to confirm. Stock and member totals
    adjust in the same transaction. Actual cash/bank transfers and deliveries
    must also be reconciled outside the system if the entry was not a mistake.
12. Viewer has no create/edit/delete permissions.

No database reset or SQL import is needed. The API automatically creates the
new Direct Sales tables using api/direct-sales-schema.sql. Existing orders,
accounts, receipts, catalogue data and credit records are kept.

Included: simpler direct sales, clear charge checkboxes and discounted prices,
redesigned branded printable/PDF invoices, ONE unified sales table with shared filters and matching Excel export,
Super Admin edit/permanent delete corrections, stock/payment/report cleanup,
built-in Viewer role with server-enforced read-only access, read-only
record dialogs, latest Direct Sales, reports/exports, updated API, public assets
and app-cache refresh. Viewer cannot create, edit, delete, upload or approve
business records. Viewer can change their own password and sign out.

Super Admin has Direct Sales access. For staff, assign the appropriate Direct
Sales permissions in User Access. Bank proof still requires Finance verification.

The existing host must already use PHP 8.1+ and the private production camy.env.
For 20 MB receipts, configure server/PHP request limits to at least 32 MB.
Invoice company details use your real CAMY_COMPANY_* settings if configured.

This archive contains no production credentials, private files, database dump,
customer records, developer source, test accounts or development tools.
It has not been uploaded or deployed automatically.
'''

files = {}
for source in sorted(DIST.rglob('*')):
    if not source.is_file():
        continue
    if source.is_symlink() or not source.resolve().is_relative_to(DIST.resolve()):
        raise RuntimeError('Unexpected build symlink')
    name = source.relative_to(DIST).as_posix()
    if source.suffix.lower() in {'.map', '.log', '.sql', '.php', '.env', '.zip', '.bak'}:
        raise RuntimeError('Unexpected non-public build file: ' + name)
    if any(part in {'private', 'node_modules', '.git', '.artifacts', 'scripts', 'src'} for part in source.relative_to(DIST).parts):
        raise RuntimeError('Unexpected private/development build path: ' + name)
    files[name] = source.read_bytes()
for source in sorted((ROOT / 'api').iterdir()):
    if source.is_file() and (source.suffix == '.php' or source.name in {'.htaccess', 'direct-sales-schema.sql'}):
        files['api/' + source.name] = source.read_bytes()
files['UPDATE-INSTRUCTIONS.txt'] = instructions.encode('utf-8')

missing = REQUIRED - files.keys()
if missing:
    raise RuntimeError('Missing hosting files: ' + ', '.join(sorted(missing)))
assert files['.htaccess'] == (ROOT / 'scripts' / 'production.htaccess').read_bytes()
assert b'camy-mobile-v14-simple-payment-status' in files['sw.js']
assert b'direct-sales-schema.sql' in files['api/config.php']
assert b'direct_sales.php' in files['api/marketplace.php']
assert files['api/direct-sales-schema.sql'].count(b'CREATE TABLE IF NOT EXISTS') == 4
for html in ('index.html', 'register.html'):
    for match in re.finditer(rb'(?:src|href)=[\'"](/assets/[^\'"]+)[\'"]', files[html]):
        assert match.group(1).decode().lstrip('/') in files, 'Missing referenced build asset'

OUTPUT.parent.mkdir(exist_ok=True)
with ZipFile(OUTPUT, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for name, content in files.items():
        archive.writestr(name, content)
with ZipFile(OUTPUT) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(files)
    for name, content in files.items():
        assert archive.read(name) == content, 'Archive contents differ: ' + name
    for name in archive.namelist():
        assert not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts
        assert 'camy.env' not in name and 'production_clean.sql' not in name

checksum = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
OUTPUT.with_suffix('.zip.sha256').write_text(checksum + '  ' + OUTPUT.name + '\n', encoding='ascii')
print(json.dumps({'archive': str(OUTPUT), 'files': len(files), 'sizeMB': round(OUTPUT.stat().st_size / 1024 / 1024, 2), 'sha256': checksum, 'verified': True}))
