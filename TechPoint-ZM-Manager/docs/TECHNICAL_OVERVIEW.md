# Technical Overview — TechPoint ZM Manager v0.2

## Architecture

- Front end: HTML, CSS and JavaScript Progressive Web App (PWA).
- Data client: Supabase JavaScript client loaded from the jsDelivr package CDN.
- Identity: Supabase Auth email/password owner sign-in.
- Database: Supabase-hosted PostgreSQL.
- Data access: Row Level Security (RLS) on all business tables; owner policies scope rows to the signed-in user's business.
- Hosting: static HTTPS hosting; the included setup guide uses Netlify.
- Device use: installable PWA on Android/Chrome and iPhone/Safari where supported.

## Main tables

- `businesses`: one owner workspace and receipt profile.
- `products`: owner-managed catalogue and quantity stock.
- `device_units`: individual phone records, one row per IMEI.
- `sales`: receipt header, customer, totals and payment state.
- `sale_items`: immutable sale-time line snapshots.
- `sale_payments`: first and later payment entries.
- `stock_movements`: quantity/device stock audit history.
- `expenses`: day-to-day business expenses.

## Transactional database functions

- `ensure_my_business`: creates the owner's workspace and fills blank contact fields with approved defaults.
- `add_device_unit`: validates and records an individually tracked phone; duplicate IMEI is prevented by a unique constraint.
- `adjust_stock`: applies a reasoned quantity change and prevents stock from going below zero.
- `create_sale`: validates items/stock, generates receipt number, writes the sale, line items, stock movements and initial payment as one database transaction.
- `record_sale_payment`: records an additional payment and updates the remaining balance/status.

## Product management rules

The product catalogue is data, not code. A user with owner access can insert products into `products` from the Add Product form. Category is free text; suggestions are conveniences only. The app does not ship with a preloaded live stock list. Accessory items use quantity stock. Individual tracked phones use the `device_units` register to track each physical unit.

## Important operational boundaries

- Internet is needed for all live data and transactional workflows. The service worker caches the app shell, not business data.
- Payment methods are records only; there is no direct mobile-money or bank gateway integration.
- The publishable key can appear in browser-side code only because RLS is designed to enforce access. Secret/service-role keys must remain server-side.
- The initial pilot provides one owner login. Staff roles, branches and advanced permission management need separate scope.
- JSON export is a convenience backup; test restoration and agree provider-managed backup/retention responsibilities separately.
