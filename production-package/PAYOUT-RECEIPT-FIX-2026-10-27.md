CAMY Admin payout receipt update - 2026-10-27

Upload the ZIP contents into the existing public_html folder, replacing matching files. Deploy the frontend and API files together. Keep existing assets as other pages or cached clients may use them.

Includes: current built frontend; api/index.php, marketplace.php, workflow.php, payout_upload.php and api/.htaccess. The root hosting .htaccess is unchanged.

No database migration, SQL import, reset, or credential change is required. No private configuration, receipts, production records, or credentials are included.

The PHP user needs write access to the existing private storage root. The receipt flow creates private payout-uploads and receipts subdirectories automatically. Large files use resumable 256 KB chunks; the overall file is not capped at 5 or 10 MB. Actual disk capacity and hosting restrictions still apply.

Proof is stored privately first; the final transaction records the existing commission amount and links its receipt. Failed saves remain retryable, and duplicate confirmation is blocked. Capturing a photo never confirms payment automatically.

Verified locally: all supported formats, WhatsApp filename, 12 MB JPEG/PDF, high resolution JPEG, storage failure/retry, payment rollback/retry, duplicate prevention, private upload ownership, camera capture/retake/remove/permission fallback/track cleanup, and desktop/mobile layout. Existing commission, credit, invoice camera, reports and customer-order export regressions pass. Browser camera tests use a simulated webcam; verify real laptop and phone cameras after deployment over HTTPS.

This archive has not been deployed.
