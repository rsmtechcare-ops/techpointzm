# TechPoint ZM Manager — Phone and Cloud Setup

## Goal

Publish TechPoint ZM — Phones & Accessories as a secure HTTPS website/PWA. The owner opens one link on Android or iPhone and installs it to the home screen. The customer does **not** need a computer. RSM TechCare needs a computer only for initial setup, publishing changes and support.

## What you need

- A dedicated email address controlled by the TechPoint ZM owner.
- A Supabase account/project owned by TechPoint ZM (recommended: the business owner controls billing and recovery).
- A Netlify account for static hosting, or another HTTPS static host.
- This project folder.
- Internet access for setup and day-to-day cloud transactions.

## A. Create the customer's Supabase database

1. Open https://supabase.com and create/sign into the account. Create a new project named `techpoint-zm-manager`.
2. Use an email/account controlled by the business owner. Save the database password in a password manager. Do not send it in WhatsApp.
3. Select a region with suitable latency and availability for Zambia. Do not choose a region solely from a guess; check the available options in the dashboard.
4. Wait for the project to finish provisioning.
5. In the project, open **SQL Editor** and create a new query.
6. Open `supabase/schema.sql` from this project, copy the whole file and paste it into SQL Editor.
7. Run the script. Confirm it completes without errors. The script creates the business profile table, inventory, device register, sales, sale items, payments, stock movement and expense tables; enables RLS; creates owner policies; and creates the transactional RPC functions.
8. Open **Table Editor** and confirm the tables appear.

## B. Configure authentication

1. In Supabase, open **Authentication → Providers** and confirm Email is enabled.
2. Keep email confirmation enabled for a real customer account where the business has access to the mailbox. The owner should verify the address from their inbox.
3. Open **Authentication → URL Configuration**.
4. Before the site is deployed, leave the project URL in place. After deployment, set the published HTTPS site as the Site URL and add the exact published URL to Redirect URLs.
5. Do not create a shared owner password for multiple people. Version 1 is designed for one owner login. Staff roles are a future phase.

## C. Add the public project settings

1. In Supabase, open **Project Settings → API** (the exact dashboard label may change).
2. Copy the Project URL.
3. Copy the public **publishable key** for browser use. Supabase documents publishable keys as suitable for apps shipped to browsers; access still depends on the signed-in user and correct RLS policies. Use a legacy anon key only as a compatibility fallback for an existing project.
4. Open this project's `config.js` and replace only the placeholder values:

```js
window.TECHPOINT_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'YOUR-PUBLIC-PUBLISHABLE-KEY',
  BUSINESS_DEFAULT_NAME: 'TechPoint ZM',
  BUSINESS_DEFAULT_PHONE: '+260 776156441',
  BUSINESS_DEFAULT_EMAIL: 'anthonymwale20@gmail.com',
  BUSINESS_DEFAULT_TAGLINE: 'Phones & Accessories',
  APP_NAME: 'TechPoint ZM | Phones & Accessories'
};
```

5. Never copy the `service_role` key or a secret API key into this file. Never publish the database password.

## D. Deploy the phone app to HTTPS

### Simple first deployment using Netlify Drop

1. Open https://app.netlify.com/drop and sign in to a hosting account controlled by TechPoint ZM where possible. If RSM TechCare deploys it initially, record the account owner and agree ongoing access/transfer in writing.
2. Drop the **contents of the `TechPoint-ZM-Manager` folder** (the folder with `index.html` at its root) into Netlify's deploy area. Do not drop the ZIP archive without extracting it first.
3. Wait for the deploy to finish. Netlify provides a URL ending in `netlify.app`.
4. Open the URL in a private/incognito browser window and verify the login page loads.
5. In Supabase Authentication → URL Configuration, set the Netlify URL as Site URL and add it as an allowed Redirect URL.
6. Open the link on the customer's phone and perform an end-to-end sign-up/sign-in test.

### Recommended ongoing maintenance

For repeated releases, keep the source in a private RSM TechCare Git repository and connect the repository to Netlify continuous deployment. This makes updates traceable and repeatable. Keep secrets out of Git; `config.js` contains only public client configuration, but restrict the repository/deploy workflow because it identifies the customer project.

## E. Install on the customer's phone

### Android (Chrome)

1. Open the published HTTPS URL in Chrome.
2. Open the browser menu (⋮).
3. Tap **Install app** or **Add to Home screen** (the exact wording depends on the device/browser version).
4. Confirm. The TechPoint ZM icon should appear on the home screen.

### iPhone (Safari)

1. Open the published HTTPS URL in Safari.
2. Tap the Share icon.
3. Choose **Add to Home Screen**.
4. Confirm the app name and tap Add.

The customer uses the installed app like a normal phone app. The underlying application and database remain hosted online. A PC is not required for normal daily use.

## F. First-run account and business setup

1. Open TechPoint ZM Manager on the phone.
2. Select **Create account**. Use the owner's business email and a unique password.
3. Confirm the email if the project requires confirmation, then sign in.
4. The database creates a private TechPoint ZM workspace tied to that user account.
5. Open **Business settings** and add the official phone/WhatsApp number, location, contact email, receipt footer and approved warranty/returns wording.
6. Do not invent a warranty policy. Use only the terms the owner confirms.

## G. Publish a test before live use

1. Create a test accessory, e.g. `TEST - Clear iPhone Pouch`; set cost, selling price and opening quantity.
2. Create a tracked model, e.g. `TEST - iPhone 13 128GB`, then register a test device using a clearly labelled test IMEI value only. Do not enter an actual customer's device details for this test.
3. Record a test sale and generate a receipt.
4. Test full payment and part-payment using test data.
5. Check the stock count and sale history.
6. Record a balance payment and re-open the receipt.
7. Test print/save PDF and WhatsApp sharing on the phone.
8. Delete the test rows through the app or mark test products archived before production. Avoid deleting live sales records.

## H. Costs and service ownership

- Review the current Supabase and Netlify plans, usage limits, backup options, region choices and billing at the time of setup. Provider pricing and terms can change; this package does not promise a free or fixed-cost hosting arrangement.
- For a business relying on the system daily, agree the required uptime expectation, backup frequency, recovery procedure and who pays for hosting/database subscriptions before launch.
- A custom domain is optional and has a separate registration/renewal cost.
- Prefer the customer to own Supabase, hosting and domain accounts. RSM TechCare should be invited with limited access needed to maintain the system.
- RSM TechCare's setup, customisation, training and support fee is separate from third-party provider charges. Agree that fee with the customer before work becomes billable.

Official provider setup references (review current instructions before deployment):
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Auth redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Netlify deploys: https://docs.netlify.com/deploy/create-deploys/

## I. Troubleshooting

- **Config warning at login:** `config.js` still has placeholder values or contains a typo.
- **Invalid API key / fetch error:** re-copy the Project URL and public publishable key. Never use the service role key.
- **Permission denied / RLS error:** confirm the full SQL script ran and the owner is signed in with the correct account. Do not disable RLS to bypass an error.
- **Email confirmation link returns to the wrong site:** add the deployed URL in Supabase Authentication URL Configuration.
- **Phone cannot install:** confirm the site is HTTPS and open it in the recommended browser (Chrome on Android, Safari on iPhone).
- **No live records without internet:** this is intentional. The app shell can cache, but database operations require a live connection to avoid stale inventory/overselling.


## v0.2 brand and contact defaults

The application branding now reads **TechPoint ZM — Phones & Accessories** and uses the supplied TechPoint mark with a blue, black and white visual theme. On first workspace creation, the following contact defaults are filled only where the business fields are blank: `+260 776156441` and `anthonymwale20@gmail.com`. The owner must verify these in Business settings before issuing real receipts. Existing non-empty profile values are preserved.

For a database created with the earlier v0.1 package, run `supabase/migrations/002_techpoint_brand_contact_defaults.sql` once before using the new application code. For a fresh project, run the complete updated `supabase/schema.sql` instead.
