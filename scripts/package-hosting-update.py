"""Create a cPanel update ZIP from the current production build and API only."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
OUTPUT = ROOT / 'production-package' / 'CAMY-HOSTING-UPDATE-2026-11-10.zip'
REQUIRED = {'index.html', 'register.html', '.htaccess', 'sw.js', 'site.webmanifest', 'api/index.php', 'api/config.php', 'api/direct_sales.php', 'api/direct-sales-schema.sql', 'api/.htaccess'}

instructions = '''CAMY HOSTING UPDATE - 10 NOVEMBER 2026

FOR THE EXISTING camymarket.com INSTALLATION

1. Back up the existing public_html, private folder and database.
2. Upload CAMY-HOSTING-UPDATE-2026-11-10.zip into the active public_html.
3. Extract the ZIP there and allow existing files to be overwritten.
   index.html, assets/ and api/ must be directly inside public_html.
4. Keep the existing private/camy.env and all private uploads unchanged.
5. Open the website and refresh. Sign in, then open Customer Orders > New Direct Sale.

No database reset or SQL import is needed. The API automatically creates the
new Direct Sales tables using api/direct-sales-schema.sql. Existing orders,
accounts, receipts, catalogue data and credit records are kept.

Included: latest compact inline Direct Sales screen (no wizard/popup), invoice
corrections, reports/exports, updated API, public assets and app-cache refresh.

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
assert files['.htaccess'] == (ROOT / 'production.htaccess').read_bytes()
assert b'camy-mobile-v7-direct-sales-inline' in files['sw.js']
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
