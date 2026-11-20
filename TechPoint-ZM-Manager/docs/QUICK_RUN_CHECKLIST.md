# v2.1 update steps (live system — no data is lost)
1. Supabase → SQL Editor → run `supabase/migrations/005_v21_team_roles.sql` (and 003 / 004 if not run yet). Never run reset_and_install.sql on the live system.
2. Netlify → drag this folder in. Open the app online → Settings → "Update app now".
3. Settings → System check → Run check (everything should show ✅).
4. Team & access: add each staff member, then create their login in Supabase → Authentication → Users (tick Auto Confirm User).
5. Laptop: Chrome/Edge → open the site → install icon in the address bar (Install app). Plug in a USB barcode scanner and scan to sell.

# v2.0 update steps (live system — no data is lost)
1. Supabase → SQL Editor → run `supabase/migrations/004_v2_audit_log.sql`. (003 too, if you haven't run it yet.) NEVER run reset_and_install.sql on the live system.
2. Netlify → Deploys → drag this whole folder in.
3. Open the app ONCE with internet → Settings → "Update app now". Close and reopen. (This saves the app + your shop data on the phone.)
4. Test offline: turn on Airplane Mode → open the app → sell something → turn data back on → watch "waiting" go to "Cloud connected" and the sale appear.
Rules: open the app online at least once a day so the phone's saved copy is fresh. Receipt numbers for offline sales start with OFFLINE- until synced.

# v0.6 update steps (existing live system — no data is lost)
1. Supabase → SQL Editor → paste `supabase/migrations/003_v06_photos_delete.sql` → Run. (Do NOT run reset_and_install.sql on a live system.)
2. Netlify → Deploys → drag this whole folder in (replace old files).
3. Open the app → Settings → **Update app now** (once). On iPhone, close and reopen the app.
4. Test: add a product with a photo, delete a test product, change theme in Settings.

# Quick Run Checklist — TechPoint ZM v0.3.0

What you need (all free tiers work for a pilot):
1. A free **Supabase** account (supabase.com) — database + login.
2. A free **Netlify** account (netlify.com) — HTTPS hosting.
3. A laptop with a browser (you), and the owner's Android/iPhone with Chrome/Safari.

## 15-minute setup
1. Supabase → New project (pick a region close to Zambia, e.g. eu-west / eu-central). Save the DB password somewhere safe.
2. Supabase → SQL Editor → paste ALL of `supabase/schema.sql` → Run. (Fresh project only.)
3. Supabase → Project Settings → API: copy **Project URL** and the **publishable (anon) key**.
4. Open `config.js` and paste both. NEVER paste a service_role/secret key.
5. Netlify → Add new site → Deploy manually → drag the `TechPoint-ZM-Manager` folder in.
6. Supabase → Authentication → URL Configuration: set **Site URL** and add a **Redirect URL** = your Netlify URL.
7. Open the Netlify URL → Create account (owner email) → confirm email → sign in.
8. Settings tab: set shop address, receipt footer, warranty/returns wording.
9. Add products (Inventory → Add product). For iPhones: item type Phone + IMEI tracking, then Register phone per handset.
10. Make a test sale, print/share the receipt, collect a balance, check Reports.
11. On the owner's phone: open the link → "Install app" button (or browser menu → Add to Home Screen).

## After you've tested
- Supabase → Authentication → turn OFF "Allow new users to sign up" once the owner account exists, so nobody else can register.
- Export a JSON backup weekly (Settings → Export).
- Free Supabase projects pause after ~1 week of no use: keep it active or upgrade for live trading.

## Troubleshooting: "can't find API"
- `SUPABASE_URL` must be ONLY `https://<project-ref>.supabase.co` — no `/rest/v1/` at the end (v0.3.1 strips it automatically).
- Key must be the publishable key (`sb_publishable_...`). Never the `sb_secret_...` key.
- Make sure `supabase/schema.sql` was run in the SQL Editor (otherwise functions like `ensure_my_business` are missing).
- After redeploying, hard-refresh the page (or close and reopen the installed app).

## v0.4.2 — sign-in only, one shared shop for the team
1. Supabase → **SQL Editor** → paste ALL of `supabase/reset_and_install.sql` → Run. (Wipes test data, rebuilds everything, adds Void Sale, Clothing/Shoes and the shared shop for the 3 team emails.)
2. Supabase → **Authentication → Users → Add user → Create new user**. Add each email with a password and tick **Auto Confirm User**:
   - rsmtech19@gmail.com (main shop account)
   - mulengaroy3@gmail.com
   - anthonymwale20@gmail.com
3. Redeploy the folder to Netlify, hard-refresh, sign in. All three see the same stock, sales and receipts.
4. Install on iPhone: open the site in **Safari** → Share → Add to Home Screen.
5. Bulk products: Inventory → Import CSV (`docs/product-import-template.csv`).

Any other email you add later gets its own separate empty shop (to share, add it to the team list in the SQL and `config.js`).
Change the shared password to something strong before real use.
