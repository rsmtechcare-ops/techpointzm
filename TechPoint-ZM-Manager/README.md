# TechPoint ZM — Phones & Accessories

Mobile-first Progressive Web App for managing phones, accessories, stock, sales and customer receipts. Built by RSM TechCare.

**Version:** 0.5.0 — faster selling
**Theme:** Blue / black / white  
**Client contact supplied:** anthonymwale20@gmail.com · +260 776156441

Read `docs/START_HERE.md` first. Then follow `docs/ROLL_OUT_TO_CLIENT.md` in order.

## Product management

The product catalogue is owner-managed. From Inventory, use **Add product** to create a product whenever needed. Product name, SKU, category, item type, buying price, selling price, opening stock and reorder threshold are entered by the owner. Categories can be typed freely; the suggested values are not a locked list. For phones, add the model as an IMEI-tracked item and register each physical handset individually. Accessories use quantity-based stock.

## Included in this source package

- Private owner sign-in using Supabase Auth.
- Cloud PostgreSQL database with Row Level Security.
- Individual phone device register (IMEI, serial, storage, colour, battery health, condition and buying cost).
- Owner-managed catalogue with quantity-based accessory stock and user-entered categories.
- Sales checkout with customer details, discounts, multiple items, payment recording and part-payments.
- Numbered receipts that can be printed/saved as PDF or shared to WhatsApp.
- Expenses, low-stock reminders, stock movement history and management reports.
- PWA manifest and service worker for Add to Home Screen installation.
- **v0.5 selling tools:** two-tap quick-sell grid with product photos, camera barcode/QR scanning, printable QR shelf labels, held sales, cart quantity steppers, WhatsApp product sharing, debtor reminders, IMEI lookup, daily close-out, profit by day, slow-moving stock report, dark mode, 58 mm receipt mode, branded receipt QR and an optional 4-digit app PIN (a screen lock only, not database encryption).
- Setup, usage, security, testing, rollout and acceptance documentation.

## Deployment status

This ZIP is a prepared source package, **not yet a live client deployment**. The Supabase Project URL and publishable key are intentionally blank. Complete the database setup, HTTPS deployment, authentication configuration, owner sign-in, live tests and client sign-off before production use.

## Important security rule

Only a Supabase **publishable key** belongs in browser-side `config.js`. Never put a secret key, service-role key or database password in public code. Keep Row Level Security enabled.

## Technical notes

The app shell can be cached, but all live data access, sign-in, stock checks, checkout, receipts and reports require internet. Offline sales are not queued. Payment channels are recorded but there is no direct Airtel Money, MTN MoMo or bank integration.
