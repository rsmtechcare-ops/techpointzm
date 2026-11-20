# TechPoint ZM Manager — Pilot Acceptance Test Plan

Run these tests with clearly labelled test data before entering real stock or customer information. Do not use a real phone's IMEI for test cases.

| ID | Test | Expected result |
|---|---|---|
| AUTH-01 | Create owner account and confirm email | Owner can sign in and gets one private TechPoint ZM workspace |
| AUTH-02 | Sign out and sign back in | Workspace records remain available only to the owner |
| SEC-01 | Attempt access from another Supabase user | Other user cannot read or alter the business records |
| PROD-01 | Add a pouch with opening quantity 10 | Product appears with quantity 10 and an opening movement |
| PROD-02 | Register phone model with IMEI tracking | Model appears with zero until individual phones are registered |
| IMEI-01 | Register two distinct test devices | Both appear as separate device units; model stock becomes two |
| IMEI-02 | Register duplicate IMEI | Database rejects duplicate IMEI |
| STOCK-01 | Adjust accessory stock +5 | Quantity and stock movement update together |
| STOCK-02 | Remove more stock than available | Database rejects adjustment; quantity does not become negative |
| SALE-01 | Sell one pouch | Sale, receipt number, line snapshot and stock reduction are saved |
| SALE-02 | Sell a particular tracked phone | Selected IMEI is marked sold and stored on receipt snapshot |
| SALE-03 | Try to sell an already-sold/unknown IMEI | Checkout is rejected |
| SALE-04 | Try to sell more accessories than available | Checkout is rejected without partial sale writes |
| PAY-01 | Complete sale with full payment | Status is Paid and balance is zero |
| PAY-02 | Complete sale with part-payment | Status is Part paid and balance is correct |
| PAY-03 | Collect the remaining balance | Payment is added and status becomes Paid |
| PAY-04 | Record more than remaining balance | Database rejects payment |
| RECEIPT-01 | Print / Save PDF from Android and iPhone | Receipt is legible and contains business, customer, items, IMEI if relevant, totals and payments |
| RECEIPT-02 | Share receipt through WhatsApp | WhatsApp opens with the correct receipt summary |
| EXP-01 | Add transport or delivery expense | Expense appears in list and period report |
| RPT-01 | Filter report by date range | Revenue, gross-profit estimate and expenses respect the selected dates |
| PWA-01 | Install from HTTPS on Android | App icon is added to home screen and launches in standalone mode where supported |
| PWA-02 | Add to Home Screen on iPhone Safari | App shortcut opens the hosted app |
| NET-01 | Disconnect internet and try checkout | App clearly reports offline; no sale is submitted or queued |
| BACKUP-01 | Export JSON records | A non-empty JSON export downloads and is stored safely |

| PROD-03 | Add a product with a brand-new custom category typed by the owner | Product saves and appears with that category; no source edit is needed |
| PROD-04 | Add a second new product after first launch | Both products remain in the owner catalogue after refresh/sign-in |
| BRAND-01 | Open the app login and installed icon | Blue, black and white theme; tagline reads Phones & Accessories |
| CONTACT-01 | Create first owner workspace | Supplied phone/email defaults appear in Business settings and can be edited by the owner |

## Release gate

Do not onboard live stock until AUTH, SEC, product, IMEI, sale, payment, receipt, PWA and backup tests pass on the actual published URL and the customer's phone. Confirm that receipt wording, warranty terms, customer fields, payment-method labels and business contact details are approved by TechPoint ZM.
