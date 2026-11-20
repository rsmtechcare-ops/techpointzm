# TechPoint ZM — Phones & Accessories | Client onboarding checklist

Use this checklist with the owner before launch. Do not enter live sales until the owner has approved the settings and the acceptance tests pass.

## Business information to confirm

- [ ] Exact receipt/business name: TechPoint ZM (confirm spelling and capitalisation).
- [ ] Shop phone / WhatsApp number (default supplied: +260 776156441; verify with owner).
- [ ] Shop location / address.
- [ ] Business email (default supplied: anthonymwale20@gmail.com; verify with owner).
- [ ] Use the supplied TechPoint mark and the application descriptor PHONES & ACCESSORIES.
- [ ] Approved receipt footer / thank-you wording.
- [ ] Exact warranty, exchange and return policy wording supplied by the owner.
- [ ] Confirm whether receipts need VAT/tax fields. Do not label receipts tax invoices unless the applicable requirements have been checked.

## Product and stock information to collect

- [ ] Any owner-entered product name and free-text category, SKU if used, buying cost, selling price, opening quantity and reorder warning level. Product entry is not fixed to a preset list.
- [ ] For each individually tracked phone model: model, storage, colour variants, condition options and typical selling price.
- [ ] For each physical tracked phone: IMEI, optional serial number, storage, colour, battery health, condition and actual acquisition cost.
- [ ] Confirm whether devices are new, used or refurbished; do not assume condition.
- [ ] Confirm how the owner wants to label pouches, chargers, cables, screen protectors and other side-hustle items.

## Receipts and payment process

- [ ] Confirm whether customer name is optional for walk-in sales.
- [ ] Confirm whether customer phone is optional or required.
- [ ] Confirm which payment options are used: cash, Airtel Money, MTN MoMo, bank transfer, card/POS or other.
- [ ] Confirm that the owner understands the app records payment details but does not verify or process the transfer.
- [ ] Confirm how part-payments and unpaid balances should be handled.
- [ ] Approve the receipt layout and warranty note using a test sale.

## Accounts and hosting

- [ ] Create/identify an email controlled by TechPoint ZM for account recovery.
- [ ] TechPoint ZM owns or controls the Supabase project and hosting/domain accounts wherever practical.
- [ ] Invite RSM TechCare with only the access needed for setup and support.
- [ ] Configure the Supabase project URL and public publishable/anon key in `config.js`.
- [ ] Run `supabase/schema.sql` and confirm there are no SQL errors.
- [ ] Add the deployed HTTPS site URL to Supabase Authentication's allowed redirect URLs.
- [ ] Confirm that no database password, service-role key or secret API key is in the website source.

## Acceptance on the owner's actual phone

- [ ] Owner can create/verify account and sign in.
- [ ] Owner can add a new product and custom category with opening stock.
- [ ] Owner can create a phone model and register an individual IMEI.
- [ ] Owner can search products and IMEI records.
- [ ] Owner can complete a test sale and see stock update.
- [ ] Owner can open the receipt and print/save PDF.
- [ ] Owner can share the receipt summary through WhatsApp.
- [ ] Owner can collect a part-payment balance.
- [ ] Owner can add an expense and view reports.
- [ ] Owner can export JSON records and store the file safely.
- [ ] Owner installs the PWA from the published HTTPS URL.
- [ ] Owner understands that checkout and database actions require internet.

## Sign-off

Business owner: ____________________________  Date: ______________

RSM TechCare representative: _______________  Date: ______________

Pilot release/version: ______________________
