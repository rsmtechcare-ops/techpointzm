# TechPoint ZM — Phones & Accessories | Daily User Guide

## Sign in

Open the installed TechPoint ZM icon or the secure HTTPS link. Sign in with the owner's account. Do not share the password. The first user account is the owner workspace for this first release.

## Configure the receipt

Open **Business settings** and confirm the business name, phone/WhatsApp, email, shop location, receipt footer and warranty/returns wording. Each value appears on receipts. The warranty/returns text must reflect the shop's real policy; the app does not create a warranty promise.

## Add ordinary products (pouches, chargers, accessories, other items)

1. Open **Inventory → Add product**. You can add as many different product lines as the business needs, whenever new stock arrives.
2. Enter the item name, SKU (optional; the app can generate one), category, item type, buying cost, selling price, low-stock threshold and opening quantity.
3. Leave IMEI tracking off for ordinary stock items.
4. Save. The stock quantity is recorded in the database.
5. To restock later, choose **Adjust stock**, enter a positive quantity, and provide a reason. To remove damaged/missing stock, enter a negative quantity and a reason.

## Add phone models and individual devices

1. Add the model as a product, e.g. `iPhone 13 128GB`.
2. Choose item type **Phone** and tick **Track each unit by IMEI / serial number**. Do not enter an opening quantity for an IMEI-tracked model.
3. Select **Register phone**.
4. Choose the model and enter the phone's IMEI. Optionally add serial number, storage, colour, battery health, condition and actual buying cost.
5. Save. Each phone is now a separate stock unit. The device register shows available devices; sold phone details remain attached to the relevant sale/receipt snapshot.
6. Check that the IMEI is correct before saving. IMEIs are unique within the business workspace.

## Make a sale and generate a receipt

1. Open **New sale**.
2. Choose a product. For an ordinary item, enter quantity and selling price. For a tracked phone, choose the exact available IMEI; quantity is one.
3. Add the item to the sale. Repeat for other items in the customer's basket.
4. Enter customer name and phone if supplied. A walk-in sale can use the default customer name.
5. Enter a discount only when approved by the owner.
6. Enter the amount received. It can be the full total, a partial payment or zero.
7. Select Cash, Airtel Money, MTN MoMo, bank transfer, card/POS or Other. Record the transaction reference where relevant. The app records the payment; it does not move money or verify the external transaction.
8. Complete the sale. The database assigns a receipt number and records the sale, item snapshots, stock reduction and first payment in one database transaction.
9. The receipt opens. Use **Print / Save PDF** or **Share WhatsApp**. On mobile, use the phone's print/share options.

## Collect an outstanding balance

1. Open **Transactions & receipts**.
2. Find the sale and select **Collect**.
3. Enter the amount received, payment method and reference.
4. Save. The balance decreases and the payment appears on the receipt when re-opened.
5. Never record a payment until the owner has actually received/confirmed it.

## Expenses

Record transport, delivery, packaging, marketing or other running expenses in **Expenses**. Enter the date, category, amount and payment method. Expenses improve the management estimate but do not make this a full accounting or tax system.

## Reports

Choose a date range in **Reports**. Revenue is based on completed sales; estimated gross profit uses the purchase cost saved against each product/device; expenses are deducted separately for management review. Reports are estimates and depend on accurate costs and complete entries.

## Corrections and data safety

- Archive discontinued products rather than deleting them. Historical receipts remain.
- Correct quantities through a reasoned stock adjustment. Do not silently change stock counts outside the app.
- Check the IMEI and payment reference before completing a sale.
- Export your records from Business settings regularly and store the file privately in a separate safe place.
- Do not save customer personal information that is not needed for the transaction.
- If a sale is wrong, contact RSM TechCare for a controlled correction process. This first release does not yet include a self-service refund/void workflow.


## Add completely new products and categories

There is no fixed catalogue in the application. Use **Inventory → Add product** whenever the business starts selling a new phone model, case, cable, charger, screen protector, power bank or any other item. The Category field accepts custom text; the visible suggested categories are shortcuts only. You do not need RSM TechCare to edit the code when the product list changes.
