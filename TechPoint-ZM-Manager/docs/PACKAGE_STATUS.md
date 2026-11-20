# Package Status — v0.2.0

## Completed in source package

- Updated app title and tagline to **TechPoint ZM — Phones & Accessories**.
- Applied a blue, black and white visual palette.
- Added the supplied TechPoint brand mark and rebuilt the PWA launcher icons.
- Added the logo to printable receipts and used a neutral SALES RECEIPT title (not a tax invoice).
- Confirmed product creation is owner-managed at runtime; the product list is not hard-coded.
- Changed the product category field to accept user-entered categories with suggestions.
- Preserved existing product edit and archive actions.
- Preserved phone IMEI registration and accessory quantity stock.
- Configured first-run business phone/email defaults; existing non-empty settings are preserved.
- Updated Supabase SQL function and added a migration for an already-created v0.1 database.
- Expanded setup, product-entry, client rollout, testing and acceptance documentation.
- Included the client email/phone provided for the project.

## Not completed / must be done by RSM TechCare with the client

- Supabase project creation and account ownership.
- Running the updated schema or migration in that project.
- Entering the real project URL and public publishable key in `config.js`.
- HTTPS deployment and Supabase Auth redirect configuration.
- Client owner account creation and sign-in verification.
- Real initial inventory entry and IMEI verification.
- Actual phone acceptance testing, receipt approval and signed handover.

## Limitations still applicable

- One owner account; no employee roles or multiple branches.
- Internet required for live data, sales, receipts and reports.
- No direct mobile-money or bank payment processing; payment methods/references are recorded only.
- No SMS/email receipt delivery.
- No self-service refund/void module.
- No bulk product CSV import screen; CSV intake files are worksheets and data is entered through the app.
- No barcode scanner or automated IMEI camera capture.
- Not a statutory VAT/tax invoice system or full accounting package.

Do not represent this source package as a live production system until the rollout and acceptance gates pass.
