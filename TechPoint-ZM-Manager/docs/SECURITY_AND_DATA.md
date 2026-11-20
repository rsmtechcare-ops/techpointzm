# Security, Privacy and Data Ownership

## Data model

Each authenticated owner has one business workspace. Products, individual devices, sales, sale lines, payments, stock movements and expenses are associated with that workspace. The initial release assumes one owner login; it does not include staff roles or multi-branch permissions.

## Access control

- Supabase Auth authenticates the owner.
- Row Level Security (RLS) is enabled for every business data table.
- Policies restrict access to rows whose `business_id` belongs to the signed-in owner.
- Database RPC functions validate the authenticated user's business and use row locks for stock-sensitive operations.
- The browser uses only the public publishable/anon key. RLS is the security boundary.

## Secret handling

Never expose the Supabase database password, service-role key, secret key, SMTP credentials or any private token in the browser, `config.js`, public Git repository, screenshots, WhatsApp or this documentation. The public project URL and publishable/anon key are intended for client-side use only when RLS is correctly configured.

## Transaction integrity

Checkout executes through a PostgreSQL function. It validates stock and device availability, increments a per-business receipt sequence, creates the sale and line snapshots, changes stock/device status, writes stock movement records and records the payment in a single database transaction. If an operation fails, PostgreSQL rolls the transaction back.

Balance collection is a separate RPC that locks the sale row, prevents payment above the balance, updates the amount paid/status and inserts a payment record.

## IMEI and customer data

IMEI and serial numbers uniquely identify physical devices and should be treated as business-sensitive identifiers. Customer names and phone numbers are personal data. Collect only what the owner needs for receipts, warranties and follow-up. Limit access to the owner account and avoid posting records/screenshots in public groups.

## Backups

Use the app's JSON export regularly and store copies separately from the device used for the shop. The app export includes business profile, products, available device records, sales and nested line/payment details, expenses and stock movements. Test that an export is downloaded and kept securely. A JSON export is a convenience copy, not a substitute for provider-managed database backups.

Hosting plans, backup features, inactivity policies and usage limits can change. Review the provider's current plan terms before launch. For a shop relying on this system daily, agree a backup frequency, recovery procedure, billing owner and response responsibility; do not treat a manual JSON export as a substitute for managed database backups.

## Known limitations of this pilot

- Internet is required for sign-in, live stock checks, checkout, payments, receipt history and reporting.
- Cached PWA files do not mean offline sales are supported.
- One business owner login; no staff access, role permissions or branches.
- Payment methods are recorded only; there is no direct integration with Airtel Money, MTN MoMo, banks or card terminals.
- No automated SMS/email receipt sending.
- No barcode/QR scanner integration; product search is available and a device IMEI can be typed/pasted.
- No return/refund/void interface in this release. Keep corrections controlled and auditable through RSM TechCare until a dedicated returns module is built.
- No statutory tax invoice or VAT computation. Confirm tax/invoice requirements with the business's accountant or relevant authority before representing receipts as tax invoices.
- Gross-profit reporting is an estimate based on saved cost prices and recorded discounts; it is not a certified accounting report.

## Incident response

If access appears compromised, reset the owner's password, review authentication sessions, inform RSM TechCare, export available records and contact the hosting provider. Never solve an access problem by disabling RLS. If data is missing, stop making further changes and preserve the latest export before attempting recovery.


## v0.2 credentials and business contact defaults

The browser configuration uses a Supabase **publishable key** (safe to expose only when every table is protected by correct RLS policies). Secret keys and service-role keys must never be placed in `config.js`. The first-run business profile defaults are the contact details supplied for TechPoint ZM (`+260 776156441`, `anthonymwale20@gmail.com`); verify them with the owner before sending receipts. The function fills these values only if the existing profile fields are blank.
