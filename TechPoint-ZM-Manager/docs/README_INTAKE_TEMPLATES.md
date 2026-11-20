# Stock intake templates

These CSV files are simple worksheets to collect stock information before entering it into TechPoint ZM Manager. The current pilot does **not** include automated CSV import; add the reviewed entries through the app screens.

- `PRODUCT_INTAKE_TEMPLATE.csv` — any phone accessory or other quantity-managed product. For ordinary items use `item_type=accessory` (or `other`) and `track_imei=false`.
- `PHONE_INTAKE_TEMPLATE.csv` — one row per physical phone (iPhone or Android) that is tracked by IMEI. Each unit needs its own IMEI. Do not use real customer or device records in test data.

Check buying and selling prices with the owner. Never guess IMEIs, battery health, device condition or stock quantity.
