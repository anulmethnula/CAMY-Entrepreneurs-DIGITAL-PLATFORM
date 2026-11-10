# CAMY Community + Invoice Camera update - 27 October 2026

Only the requested additions:
1. Compact WhatsApp Community card below the Entrepreneur My Profile support area. Contact support remains +94 77 716 5336.
2. Slim Community banner directly after the four Entrepreneur Home KPI cards, leaving existing sections in their current order.
3. Existing invoice attachment field supports Upload document and Use camera, with capture/retake/review/use-photo, selected image/PDF preview, remove/replace, and explicit existing Submit invoice action.

The supplied community address is internal only; no visible URL, copy input, QR code or navigation item was added.
Camera audio is disabled. Streams stop after accept, close, unmount, and late permission resolution after close. Preview object URLs are revoked.
Only file-type validation is applied in the invoice attachment UI. No new frontend file-size restriction or maximum-size label is present. Existing image preparation and the existing invoice submission endpoint are retained.
Hosting/proxy/PHP request limits still apply; an actual server upload rejection is shown as an error rather than silently ignored. Backend limits have not been changed.

Upload:
Extract CAMY-COMMUNITY-CAMERA-UPDATE-2026-10-27.zip into the active public_html with overwrite enabled.
This is a frontend-only update containing index.html, register.html and their compiled assets. Existing API, Apache configuration, private settings, database and uploaded files are not included or replaced.
No database update or SQL import is needed.
Nothing has been deployed to hosting.

Verified:
- Production build.
- Browser layouts at 1440, 1024, 768 and 390px.
- Both Community button targets, new-tab isolation, placement, no visible raw URL, and unchanged existing Home sections.
- Simulated browser camera: capture, retake, attach, image preview, explicit invoice POST with unchanged reference and endpoint; no automatic submission.
- PDF indicator, large PDF selection (without a size rejection), image replacement/removal and unsupported-file error.
- Permission denied, no camera, unsupported browser, close/unmount/late-permission stream cleanup and preview URL cleanup.
- Existing Customer Orders workbook, XLSX and report-model regressions.
Physical device camera permission and availability remain subject to the user's browser/device; camera access requires a secure context (HTTPS or localhost).
