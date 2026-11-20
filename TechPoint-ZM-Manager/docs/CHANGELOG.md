# Changelog

## v2.1.0 — team, roles & laptop edition
- NEW Team & access tab (owners): add people, set Owner / Manager / Cashier, disable or remove. Replaces the hard-coded email list in the database.
- Roles: Cashier = sell + view stock only (no Reports, Expenses, Team, deleting, voiding, editing products). Manager = everything except Team. Owner = everything. Deleting and voiding are also blocked in the database for cashiers.
- NEW System check (Settings): proves the dashboard, stock, IMEI phones, prices and receipts all agree and flags anything that does not.
- Laptop: wider layout, keyboard shortcuts (F2 new sale, Alt+1-6 tabs, / search, Ctrl+Enter finish sale), USB barcode scanner support, and "Paste from Excel" bulk product entry.
- DB: supabase/migrations/005_v21_team_roles.sql (run once).

## v2.0.0 — offline edition
- NEW OFFLINE MODE: the app opens and works without internet (saved copy of stock, prices and recent sales on the phone).
- Selling offline: sales are saved on the phone with an OFFLINE-xxxxx receipt and sent to the cloud automatically when the internet returns (duplicate-safe).
- "Lie-fi" safe: checks real connection to the database, not just the phone's wifi icon.
- Status pill shows Offline / N waiting / Cloud connected. Settings → "Sales waiting to sync" with Retry / Discard for any sale the database rejects.
- Other edits (new products, expenses, stock changes, payments) need internet and say so clearly.
- NEW Activity log (who added, changed, archived, deleted or voided what) — Settings → Activity log.
- Offline cache now also keeps the database library, QR and scanner libraries.
- DB: supabase/migrations/004_v2_audit_log.sql (run once).

## v0.6.0 — final polish
- FIXED: v05.css was missing from the package, so the lock screen, switches, quick-sell, scanner and dark mode were unstyled. Added.
- FIXED: dashboard and inventory disagreed (archived items were still listed). Inventory now shows active products only; "Archived" filter lists the rest.
- FIXED: today's sales/reports used UTC dates; now use Zambia local time.
- NEW: Delete products (items with sales history are archived instead), Restore, delete expenses, remove mistaken phone registrations.
- NEW: 4 themes (Light, Dark, Black & Blue, Royal Blue). Choice is remembered.
- NEW: Settings: default low-stock level, products/sales CSV export, archived products, About + "Update app now".
- NEW: Product photos saved to the cloud (take a photo or choose from gallery); old on-phone photos sync automatically.
- FASTER: service worker no longer hangs on slow networks; CDN library cached.
- DB: supabase/migrations/003_v06_photos_delete.sql (run once).

## v0.5.0 — faster selling
- Quick-sell grid (best sellers or full catalogue) with photos, two-tap add and IMEI picker.
- Camera barcode/QR scanning plus printable 3-up QR shelf labels (`TPZ:<SKU>`).
- Hold and resume a sale; cart quantity steppers; clear basket.
- WhatsApp product share (photo + price when supported) from Inventory and slow-moving report.
- Debtors panel with per-customer balances and WhatsApp reminders.
- IMEI/serial lookup across in-stock phones and sold history (buyer, receipt, cost, profit).
- Daily close-out with payment mix, expected cash, counted-cash difference and printable day sheet.
- Profit by day table and slow-moving stock report (30/60/90 days).
- Dark mode, 58 mm receipt print mode, branded receipt QR, optional 4-digit app PIN with auto-lock.
- No database migration required; `sw.js` cache bumped to v8 and `v05.css` added.

## v0.4.2
- Sign-in only (sign-up tab removed), auto-login removed. Shared shop for the 3 team emails. reset_and_install.sql added.

## v0.4.0 — black edition
- Splash/welcome page with TechPoint ZM branding, black premium theme, iPhone-ready PWA (icons, full-screen, safe areas, bottom tab bar).
- Removed config warnings. Added Void Sale, CSV product import, Clothing and Shoes item types, SQL migration.

## v0.3.0 — polish and usability
- Fixed: empty toast bubble showing on first load.
- Dashboard: time-aware greeting and 7-day sales trend chart.
- Receipts: WhatsApp button now sends straight to the customer's number (Zambian +260 format handled).
- Reports: payments-by-method breakdown and Export sales CSV (opens in Excel).
- PWA: "Install app" button; service worker now network-first so updates reach the phone immediately.
- Added docs/QUICK_RUN_CHECKLIST.md.


## v0.2.0 — branded TechPoint ZM pilot source package

- Updated title, sub-brand and receipt descriptor to **TechPoint ZM — Phones & Accessories**.
- Applied blue, black and white visual palette and rebuilt app icons.
- Integrated supplied TechPoint mark into the application, printable receipt and document proposal.
- Made product categories user-entered with suggestions; the catalogue remains owner-managed.
- Updated phone labels and help copy to cover phones more generally.
- Changed receipt heading to the neutral **SALES RECEIPT** label; this is not represented as a VAT/tax invoice.
- Removed the unused original full logo lockup from the app package because its old descriptor did not match the approved Phones & Accessories wording.
- Added first-run contact defaults (+260 776156441 and anthonymwale20@gmail.com); only blank profile fields are populated.
- Updated Supabase publishable-key configuration and migration notes.
- Added complete rollout plan, product-entry guide, technical overview and client acceptance sign-off.
- Added a fresh client implementation proposal.

## Existing pilot limits carried forward

- The package still requires a live Supabase project, HTTPS hosting, auth setup and phone acceptance testing.
- One owner login; no staff roles or branches.
- Payment method recording only, not payment processing.
- No offline checkout, returns/void workflow, bulk CSV import, barcode/IMEI camera scanning or statutory tax invoice claim.
