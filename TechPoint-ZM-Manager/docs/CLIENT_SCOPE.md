# Client Solution Brief — TechPoint ZM | Phones & Accessories

**Prepared by:** RSM TechCare  
**Product:** TechPoint ZM — Phones & Accessories  
**Purpose:** A mobile-first stock, sales and receipt system for TechPoint ZM.

## Business context

TechPoint ZM sells phones and accessories, including iPhones, pouches and other products. The owner does not have a PC, so the software must be usable from a smartphone without requiring a local computer to remain switched on.

## Proposed solution

RSM TechCare proposes a hosted, installable web application (PWA) backed by a secure cloud database. The owner accesses it through a private sign-in link and can add it to the phone's home screen. The customer can use it on Android or iPhone with an internet connection.

## First-release functions

1. **Product and stock catalogue** — Any owner-entered phone or accessory product, with free-text categories, buying price, selling price, stock quantity and restock thresholds.
2. **Individual phone register** — each IMEI-tracked handset stored as a separate unit with IMEI, optional serial number, storage, colour, battery health, condition and buying cost.
3. **Sales checkout** — multi-item basket, customer details, optional discount and payment recording.
4. **Payment tracking** — cash, Airtel Money, MTN MoMo, bank transfer, card/POS or other; full and part-payment with an outstanding balance.
5. **Receipts** — automatic sequential receipt number, business/contact details, customer details, sold items, IMEI details where relevant, totals, discount, payment and balance. Print/save PDF or share a receipt summary through WhatsApp.
6. **Stock and expenses** — controlled stock adjustments with reasons, plus transport, delivery, packaging and other expense records.
7. **Reports** — date-filtered sales, estimated gross profit, expenses, balances and product performance.
8. **Data and access** — individual owner login, owner-level data isolation and JSON export.

## Device requirements

- **TechPoint ZM:** Android or iPhone with a supported modern browser and internet access. No PC is required for everyday operations.
- **RSM TechCare:** PC and internet access for initial database configuration, publishing, software updates, data export support and maintenance.

## Deployment model

The application files are hosted on an HTTPS static host. Supabase provides authentication and a PostgreSQL database. The database and hosting accounts should preferably be registered to TechPoint ZM, with RSM TechCare invited for technical maintenance. This avoids making the customer's business records dependent on a personal account controlled only by the developer.

## Assumptions to confirm with TechPoint ZM

- Official receipt business name and logo (if available).
- Business phone/WhatsApp, email and physical location.
- Whether the shop sells new, used or refurbished phones and which condition labels it wants.
- Required IMEI/serial fields and whether battery health must always be captured.
- Approved warranty, exchange and returns wording.
- Whether customer name/phone is required or optional.
- Whether receipts need tax/VAT details. No VAT computation or statutory tax invoice is claimed in this release.
- Whether any staff members besides the owner need access. Staff roles are not included in v1 pilot.

## Not included in the first pilot

Direct mobile-money/card payment processing, automatic payment verification, SMS/email receipt delivery, offline checkout, barcode/IMEI scanning, multi-user roles, multi-branch operation, automated supplier management, full accounting/payroll, statutory tax filing, and returns/refund workflows. These can be separately scoped after the owner validates the first release.

## Acceptance and handover

The pilot is accepted when the published HTTPS app can be installed/opened on the owner's phone; the owner can sign in; create and find accessory stock; register a phone IMEI; complete a test sale; see the corresponding stock movement and transaction; generate/print/share the receipt; collect a balance payment; view reports; and export records. Live use begins only after TechPoint ZM approves receipt text and performs the agreed tests.

## Commercial note

This scope brief does not set a development fee or third-party subscription price. RSM TechCare should issue a separate quotation after confirming branding, receipt format, hosting ownership, support period, number of users and any requested additions. Cloud provider charges, domain renewal, ongoing maintenance and custom development should be shown separately.


## Project contact and branding

Client contact supplied: **anthonymwale20@gmail.com** · **+260 776156441**. The application tagline is **PHONES & ACCESSORIES** and the visual palette is blue, black and white. Verify the business contact details in the profile before printing receipts.


## Owner-managed catalogue guarantee

The first-release catalogue is not a fixed code list and is not preloaded with assumed products. The owner uses Inventory → Add product to create, name, categorise, price and set the opening stock for any product they begin selling. Category is free text; suggested categories are optional shortcuts. Existing products can be edited or archived by the owner. Quantity-based items (such as cases, pouches, chargers, cables and other accessories) use normal stock quantities. Individually tracked phones can be set to IMEI tracking and registered one handset at a time. Adding an ordinary new product does not require a code change, database schema change or a request to RSM TechCare.
