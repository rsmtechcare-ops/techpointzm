# RSM TechCare Delivery Plan — TechPoint ZM

This is the step-by-step plan from source package to a customer-approved live application.

## Gate 0 — Confirm scope and commercial terms

Before paid implementation starts, confirm with the owner:

- Final feature scope and any exclusions.
- Setup/customisation fee, payment milestones and due dates.
- Who pays for Supabase, hosting, domain and any third-party subscriptions.
- Who owns the Supabase/hosting/domain accounts (recommended: TechPoint ZM).
- Warranty/returns wording shown on receipts.
- Product data, stock counts and receipt layout.
- What post-launch support is included and its duration.

Do not imply a confirmed budget, warranty policy, deployment date or subscription price until agreed in writing.

## Gate 1 — Prepare the source

1. Keep this ZIP as the release source and make a separate working copy.
2. Check `config.js` has only the correct Supabase Project URL and public publishable key.
3. Confirm no service-role/secret key, database password or customer data is committed.
4. Record the source version and keep a secure backup before each release.

## Gate 2 — Create the client's cloud database

1. Have the owner create or control their Supabase account using their business email.
2. Create a dedicated project for TechPoint ZM.
3. Save database credentials in a password manager controlled by the owner.
4. For a fresh project, run all of `supabase/schema.sql` in the SQL Editor.
5. If the earlier v0.1 schema is already installed, run `supabase/migrations/002_techpoint_brand_contact_defaults.sql`.
6. Verify tables, functions and Row Level Security (RLS) policies. Do not disable RLS to make an error disappear.
7. Copy the Project URL and public publishable key from the Supabase project. Do not copy any secret key.

## Gate 3 — Configure and deploy the web app

1. Open `config.js` and enter the Supabase URL and publishable key.
2. Leave the business name, phone and email defaults as approved, or edit them only after the owner confirms.
3. Deploy the contents of the app folder (the folder containing `index.html`) to an HTTPS host such as Netlify.
4. For Netlify manual deploy, extract the ZIP first and drag the `TechPoint-ZM-Manager` folder/files to the deploy area. For ongoing releases, prefer Git-connected continuous deployment.
5. Copy the actual deployed URL.
6. In Supabase Authentication → URL Configuration, set the Site URL and allowed Redirect URL to the deployed HTTPS URL.
7. Test sign-up, email confirmation (if enabled), sign-in, sign-out and password recovery before handing the link to the owner.

## Gate 4 — Owner setup and business profile

1. The owner creates their own account; RSM TechCare should not keep the owner's private password.
2. Sign in on the customer's phone.
3. Open Business settings and confirm business name, phone, email, location and receipt footer.
4. Confirm the warranty/returns text with the owner. Never invent warranty periods or promises.
5. Save and generate a test receipt to verify that details are correct.

## Gate 5 — Load the initial catalogue

1. Ask the owner to prepare the product intake sheets.
2. Count and verify actual opening stock together with the owner.
3. Add quantity-managed accessories via Inventory → Add product.
4. Add each phone model as an IMEI-tracked product, then register every physical phone separately.
5. Check SKUs, costs, selling prices, quantities, IMEIs and battery/condition records against the physical stock.
6. Do not use invented sample stock in the live catalogue.

## Gate 6 — Phone installation

### Android

1. Open the deployed HTTPS link in Chrome.
2. Use the browser menu and select Install app or Add to Home screen (wording varies by Android/Chrome version).
3. Open the new icon and sign in.

### iPhone (Safari)

1. Open the deployed HTTPS link in Safari.
2. Tap Share → Add to Home Screen.
3. Open the icon and sign in.

The owner needs a working internet connection for authentication, stock, checkout, receipts and reports. The app shell can be cached, but live sales are not supported offline.

## Gate 7 — Joint acceptance test

Run every test in `TEST_PLAN.md` on the actual phone and deployed URL. At minimum:

- Add/edit/archive a product and create a custom category.
- Register a test IMEI and reject a duplicate.
- Complete a full payment sale and a part-payment sale.
- Verify stock decreases exactly once.
- Collect a balance and confirm the updated receipt.
- Print/save a PDF and share the receipt through WhatsApp.
- Record an expense and check reports.
- Test sign-out/sign-in, another unauthorized account, backup export and offline warning.

Use clearly labelled test data. Do not use a genuine device IMEI or real customer payment details for tests.

## Gate 8 — Training and sign-off

Show the owner how to:

- Add products and new product categories.
- Register every phone's IMEI.
- Restock/adjust accessories with a reason.
- Record a sale and payment method/reference.
- Generate, print/save and share a receipt.
- Collect a balance, record expenses and read reports.
- Export records and contact RSM TechCare for support.

Obtain written approval using `ACCEPTANCE_SIGNOFF.md`. Do not call the system live/accepted until the owner signs off.

## Gate 9 — Aftercare

Agree the support period and response hours before launch. Keep a release log. For incidents, first preserve an export and relevant error details, then investigate without disabling security controls. Review cloud/hosting invoices and backups with the owner. Any new feature outside approved scope should be estimated and approved separately.

## Completion definition

The job is complete only when the app is deployed at an owner-approved HTTPS URL, the owner can use it from their phone, live records are stored in the client's database, receipts are approved, critical tests pass, the owner has been trained, backups/ownership are explained, and acceptance is recorded.
