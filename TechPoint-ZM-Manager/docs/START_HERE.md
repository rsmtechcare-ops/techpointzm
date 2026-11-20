# START HERE — TechPoint ZM Manager v0.2

**Brand:** TechPoint ZM  
**Tagline:** PHONES & ACCESSORIES  
**Built by:** RSM TechCare  
**Client contact:** anthonymwale20@gmail.com | +260 776156441

## What this package is

A mobile-first, installable web application for the owner to manage a phone and accessories business. It is designed for use on Android or iPhone. The owner does not need a PC for normal daily work. RSM TechCare needs a PC for initial database configuration, deployment, source updates and technical support.

## Important status

This is a branded pilot source package. It is **not a live production service** until a Supabase project is created, the SQL schema is run, the public browser configuration is set, the site is deployed to HTTPS, and the phone acceptance tests pass.

## Quick start for RSM TechCare

1. Extract the ZIP.
2. Open `TechPoint-ZM-Manager/config.js`.
3. Create the client's Supabase project and use `supabase/schema.sql` for a new project. If the old v0.1 schema is already installed, run `supabase/migrations/002_techpoint_brand_contact_defaults.sql` instead.
4. Put the Project URL and **publishable key** in `config.js`. Never put a secret/service-role key there.
5. Deploy the contents of the `TechPoint-ZM-Manager` folder to HTTPS hosting (the guide uses Netlify).
6. Set the deployed URL in Supabase Auth URL Configuration.
7. Have the owner create and verify their own sign-in account.
8. Verify the business profile contact details and policy wording.
9. Add the owner's real products through **Inventory → Add product**. No catalogue needs to be hard-coded or rebuilt for each new item.
10. Complete `TEST_PLAN.md` and `ACCEPTANCE_SIGNOFF.md` before live use.

## Add products whenever the owner needs

- For an ordinary accessory: Inventory → Add product → enter name, SKU if used, any category, item type Accessory, cost, selling price, opening quantity and low-stock threshold → Save product.
- For an individually tracked phone: add the phone model as item type Phone, turn on IMEI tracking and save. Then select Register phone and enter one record per physical device.
- The category box accepts custom text. The suggested values are examples only. The owner is not restricted to a fixed product list.

## Package map

- `index.html`, `styles.css`, `app.js`, `config.js`: web application
- `assets/`: install icons and TechPoint logo mark
- `branding/`: approved brand usage guidance; the application uses the corrected Phones & Accessories descriptor
- `supabase/schema.sql`: fresh-project SQL setup
- `supabase/migrations/`: update for a database created with the earlier v0.1 package
- `docs/`: setup, usage, security, testing, rollout and sign-off guides
- `client-docs/`: editable client implementation proposal
- `docs/CLIENT_CONTACT_AND_HANDOVER.md`: confirmed project contacts and handover steps

## Do not skip

Do not enter real customer/device data until the client has confirmed the privacy/warranty wording, the owner has their own account, RLS is enabled, receipts have been approved, and the full acceptance checklist passes on the actual phone.
