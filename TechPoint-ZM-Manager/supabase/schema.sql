-- TechPoint ZM Manager - Supabase/PostgreSQL schema
-- Run the entire file in Supabase Dashboard > SQL Editor.
-- Never put a Supabase service_role/secret key in this browser application.

create extension if not exists pgcrypto;

-- (shop_owner() helper is created first)
-- One shared shop for the TechPoint team (all 3 emails see the same stock and sales).
create or replace function public.shop_owner() returns uuid
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select u.id from auth.users u where lower(u.email) = 'rsmtech19@gmail.com'
       and exists (select 1 from auth.users me where me.id = auth.uid()
         and lower(me.email) in ('mulengaroy3@gmail.com','anthonymwale20@gmail.com','rsmtech19@gmail.com'))),
    auth.uid());
$$;
revoke all on function public.shop_owner() from public, anon;
grant execute on function public.shop_owner() to authenticated;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null default 'TechPoint ZM',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  receipt_footer text not null default 'Thank you for shopping with TechPoint ZM.',
  warranty_note text not null default 'Please keep this receipt for your records. Warranty terms are subject to the terms agreed at purchase.',
  currency text not null default 'ZMW' check (currency = 'ZMW'),
  next_receipt_no bigint not null default 1 check (next_receipt_no > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  sku text not null,
  category text not null default 'Other',
  item_type text not null default 'other' check (item_type in ('phone','accessory','clothing','shoes','other')),
  track_imei boolean not null default false,
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  reorder_level integer not null default 1 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sku),
  unique (id, business_id)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  receipt_number text not null,
  customer_name text not null default 'Walk-in customer',
  customer_phone text not null default '',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  balance_due numeric(12,2) not null default 0 check (balance_due >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('paid','part_paid','unpaid')),
  status text not null default 'completed' check (status in ('completed','voided')),
  payment_method text not null default 'cash',
  payment_reference text not null default '',
  notes text not null default '',
  sale_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,
  unique (business_id, receipt_number),
  unique (id, business_id)
);

create table if not exists public.device_units (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null,
  imei text not null,
  serial_number text not null default '',
  storage text not null default '',
  colour text not null default '',
  battery_health integer check (battery_health between 1 and 100),
  device_condition text not null default 'New' check (device_condition in ('New','Like New','Used - Excellent','Used - Good','Used - Fair','Refurbished')),
  purchase_cost numeric(12,2) not null default 0 check (purchase_cost >= 0),
  status text not null default 'in_stock' check (status in ('in_stock','sold','returned','reserved','written_off')),
  sale_id uuid,
  created_at timestamptz not null default now(),
  unique (business_id, imei),
  foreign key (product_id, business_id) references public.products(id, business_id) on delete cascade,
  foreign key (sale_id) references public.sales(id) on delete set null
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null,
  product_id uuid not null,
  device_unit_id uuid,
  item_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  device_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (sale_id, business_id) references public.sales(id, business_id) on delete cascade,
  foreign key (product_id, business_id) references public.products(id, business_id),
  foreign key (device_unit_id) references public.device_units(id) on delete set null
);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','airtel_money','mtn_momo','bank_transfer','card','other')),
  reference text not null default '',
  paid_at timestamptz not null default now(),
  foreign key (sale_id, business_id) references public.sales(id, business_id) on delete cascade
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null,
  device_unit_id uuid,
  movement_type text not null check (movement_type in ('opening','restock','sale','sale_void','adjustment','device_added','device_sold','device_returned','write_off')),
  quantity_change integer not null,
  quantity_after integer not null check (quantity_after >= 0),
  reason text not null default '',
  reference_id uuid,
  created_at timestamptz not null default now(),
  foreign key (product_id, business_id) references public.products(id, business_id) on delete cascade
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 160),
  category text not null default 'Other',
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text not null default 'cash',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists products_business_idx on public.products(business_id, is_active, name);
create index if not exists sales_business_date_idx on public.sales(business_id, sale_date desc);
create index if not exists device_units_product_status_idx on public.device_units(product_id, status);
create index if not exists stock_movements_business_date_idx on public.stock_movements(business_id, created_at desc);
create index if not exists expenses_business_date_idx on public.expenses(business_id, expense_date desc);

-- Row Level Security: users can access only rows belonging to their own business.
alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.device_units enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.expenses enable row level security;

drop policy if exists business_owner_all on public.businesses;
create policy business_owner_all on public.businesses for all
  using (owner_id = public.shop_owner()) with check (owner_id = public.shop_owner());

drop policy if exists products_owner_all on public.products;
create policy products_owner_all on public.products for all
  using (business_id in (select id from public.businesses where owner_id = public.shop_owner()))
  with check (business_id in (select id from public.businesses where owner_id = public.shop_owner()));

drop policy if exists device_units_owner_all on public.device_units;
create policy device_units_owner_all on public.device_units for all
  using (business_id in (select id from public.businesses where owner_id = public.shop_owner()))
  with check (business_id in (select id from public.businesses where owner_id = public.shop_owner()));

drop policy if exists sales_owner_all on public.sales;
create policy sales_owner_all on public.sales for all
  using (business_id in (select id from public.businesses where owner_id = public.shop_owner()))
  with check (business_id in (select id from public.businesses where owner_id = public.shop_owner()));

drop policy if exists sale_items_owner_all on public.sale_items;
create policy sale_items_owner_all on public.sale_items for all
  using (business_id in (select id from public.businesses where owner_id = public.shop_owner()))
  with check (business_id in (select id from public.businesses where owner_id = public.shop_owner()));

drop policy if exists sale_payments_owner_all on public.sale_payments;
create policy sale_payments_owner_all on public.sale_payments for all
  using (business_id in (select id from public.businesses where owner_id = public.shop_owner()))
  with check (business_id in (select id from public.businesses where owner_id = public.shop_owner()));

drop policy if exists stock_movements_owner_all on public.stock_movements;
create policy stock_movements_owner_all on public.stock_movements for all
  using (business_id in (select id from public.businesses where owner_id = public.shop_owner()))
  with check (business_id in (select id from public.businesses where owner_id = public.shop_owner()));

drop policy if exists expenses_owner_all on public.expenses;
create policy expenses_owner_all on public.expenses for all
  using (business_id in (select id from public.businesses where owner_id = public.shop_owner()))
  with check (business_id in (select id from public.businesses where owner_id = public.shop_owner()));

-- Create the owner's business workspace and fill only blank first-run contact fields.
-- Existing values are never overwritten by the application defaults.
drop function if exists public.ensure_my_business(text);
create or replace function public.ensure_my_business(
  p_business_name text default 'TechPoint ZM',
  p_phone text default '+260 776156441',
  p_email text default 'anthonymwale20@gmail.com'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required.'; end if;
  select id into v_id from public.businesses where owner_id = public.shop_owner() limit 1;
  if v_id is null then
    insert into public.businesses(owner_id, business_name, phone, email)
    values (
      public.shop_owner(),
      coalesce(nullif(trim(p_business_name), ''), 'TechPoint ZM'),
      coalesce(nullif(trim(p_phone), ''), ''),
      coalesce(nullif(trim(p_email), ''), '')
    )
    returning id into v_id;
  else
    update public.businesses
       set phone = case when trim(coalesce(phone,'')) = '' then coalesce(nullif(trim(p_phone),''),'') else phone end,
           email = case when trim(coalesce(email,'')) = '' then coalesce(nullif(trim(p_email),''),'') else email end,
           updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Add an individual device to tracked stock (one row per IMEI).
create or replace function public.add_device_unit(
  p_product_id uuid, p_imei text, p_serial_number text default '',
  p_storage text default '', p_colour text default '', p_battery_health integer default null,
  p_condition text default 'Used - Good', p_purchase_cost numeric default 0
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare v_business_id uuid; v_unit_id uuid; v_qty integer;
begin
  select business_id into v_business_id from public.products
   where id = p_product_id and business_id in (select id from public.businesses where owner_id = public.shop_owner())
     and is_active and track_imei for update;
  if v_business_id is null then raise exception 'Tracked phone product not found.'; end if;
  if length(trim(coalesce(p_imei,''))) < 8 then raise exception 'Enter a valid IMEI.'; end if;
  if p_battery_health is not null and (p_battery_health < 1 or p_battery_health > 100) then raise exception 'Battery health must be 1-100.'; end if;
  insert into public.device_units(business_id,product_id,imei,serial_number,storage,colour,battery_health,device_condition,purchase_cost)
  values(v_business_id,p_product_id,trim(p_imei),coalesce(trim(p_serial_number),''),coalesce(trim(p_storage),''),coalesce(trim(p_colour),''),p_battery_health,p_condition,greatest(coalesce(p_purchase_cost,0),0))
  returning id into v_unit_id;
  update public.products set stock_qty = stock_qty + 1, updated_at = now() where id = p_product_id returning stock_qty into v_qty;
  insert into public.stock_movements(business_id,product_id,device_unit_id,movement_type,quantity_change,quantity_after,reason)
  values(v_business_id,p_product_id,v_unit_id,'device_added',1,v_qty,'Individual device registered');
  return v_unit_id;
end;
$$;

-- Stock adjustment for non-IMEI accessories and other quantity-managed items.
create or replace function public.adjust_stock(p_product_id uuid, p_change integer, p_reason text)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare v_business_id uuid; v_qty integer; v_after integer;
begin
  if p_change = 0 then raise exception 'Stock adjustment cannot be zero.'; end if;
  select business_id, stock_qty into v_business_id, v_qty from public.products
   where id = p_product_id and business_id in (select id from public.businesses where owner_id = public.shop_owner())
     and is_active and not track_imei for update;
  if v_business_id is null then raise exception 'Quantity-managed product not found.'; end if;
  v_after := v_qty + p_change;
  if v_after < 0 then raise exception 'There is not enough stock for this adjustment.'; end if;
  update public.products set stock_qty = v_after, updated_at = now() where id = p_product_id;
  insert into public.stock_movements(business_id,product_id,movement_type,quantity_change,quantity_after,reason)
  values(v_business_id,p_product_id,case when p_change > 0 then 'restock' else 'adjustment' end,p_change,v_after,coalesce(nullif(trim(p_reason),''),'Manual stock adjustment'));
  return v_after;
end;
$$;

-- Atomic checkout: creates the sale, snapshots every line, updates stock and records first payment.
create or replace function public.create_sale(
  p_customer_name text default 'Walk-in customer',
  p_customer_phone text default '',
  p_discount numeric default 0,
  p_items jsonb default '[]'::jsonb,
  p_amount_paid numeric default 0,
  p_payment_method text default 'cash',
  p_payment_reference text default '',
  p_notes text default ''
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_business_id uuid; v_seq bigint; v_sale_id uuid; v_receipt text;
  v_subtotal numeric(12,2) := 0; v_total numeric(12,2); v_paid numeric(12,2);
  v_item jsonb; v_product public.products%rowtype; v_device public.device_units%rowtype;
  v_qty integer; v_unit_price numeric(12,2); v_line numeric(12,2); v_device_id uuid;
  v_device_details jsonb; v_after integer;
begin
  if auth.uid() is null then raise exception 'Sign in is required.'; end if;
  select id, next_receipt_no into v_business_id, v_seq from public.businesses where owner_id = public.shop_owner() for update;
  if v_business_id is null then raise exception 'Business profile not found. Complete setup first.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one item.'; end if;
  if p_payment_method not in ('cash','airtel_money','mtn_momo','bank_transfer','card','other') then raise exception 'Choose a valid payment method.'; end if;

  -- Validation and subtotal pass (locks product rows before checkout).
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    if v_qty < 1 or v_unit_price < 0 then raise exception 'Invalid quantity or selling price.'; end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and business_id = v_business_id and is_active for update;
    if not found then raise exception 'A selected product is unavailable.'; end if;
    if v_product.track_imei then
      if v_qty <> 1 or nullif(v_item->>'device_unit_id','') is null then raise exception 'Select one specific phone IMEI for each tracked phone sold.'; end if;
      perform 1 from public.device_units where id = (v_item->>'device_unit_id')::uuid and product_id = v_product.id and business_id = v_business_id and status = 'in_stock' for update;
      if not found then raise exception 'That individual phone is no longer in stock.'; end if;
    else
      if v_product.stock_qty < v_qty then raise exception 'Insufficient stock for ' || v_product.name || '. Available: ' || v_product.stock_qty; end if;
    end if;
    v_subtotal := v_subtotal + (v_qty * v_unit_price);
  end loop;
  v_subtotal := round(v_subtotal,2);
  if coalesce(p_discount,0) < 0 or coalesce(p_discount,0) > v_subtotal then raise exception 'Discount must be between zero and the subtotal.'; end if;
  v_total := v_subtotal - coalesce(p_discount,0);
  v_paid := coalesce(p_amount_paid,0);
  if v_paid < 0 or v_paid > v_total then raise exception 'Amount paid must be between zero and the total.'; end if;

  v_receipt := 'TPZ-' || to_char(now(),'YYMM') || '-' || lpad(v_seq::text,6,'0');
  update public.businesses set next_receipt_no = next_receipt_no + 1, updated_at = now() where id = v_business_id;
  insert into public.sales(business_id,receipt_number,customer_name,customer_phone,subtotal,discount,total,amount_paid,balance_due,payment_status,payment_method,payment_reference,notes)
  values(v_business_id,v_receipt,coalesce(nullif(trim(p_customer_name),''),'Walk-in customer'),coalesce(trim(p_customer_phone),''),v_subtotal,coalesce(p_discount,0),v_total,v_paid,v_total-v_paid,
    case when v_paid = v_total then 'paid' when v_paid > 0 then 'part_paid' else 'unpaid' end,p_payment_method,coalesce(trim(p_payment_reference),''),coalesce(trim(p_notes),''))
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and business_id = v_business_id for update;
    v_line := round(v_qty * v_unit_price,2);
    v_device_id := nullif(v_item->>'device_unit_id','')::uuid;
    v_device_details := '{}'::jsonb;
    if v_product.track_imei then
      select * into v_device from public.device_units where id = v_device_id and product_id = v_product.id and business_id = v_business_id and status = 'in_stock' for update;
      if not found then raise exception 'Phone IMEI is no longer available.'; end if;
      update public.device_units set status = 'sold', sale_id = v_sale_id where id = v_device_id;
      v_device_details := jsonb_build_object('imei',v_device.imei,'serial_number',v_device.serial_number,'storage',v_device.storage,'colour',v_device.colour,'battery_health',v_device.battery_health,'condition',v_device.device_condition);
      update public.products set stock_qty = stock_qty - 1, updated_at = now() where id = v_product.id returning stock_qty into v_after;
      insert into public.stock_movements(business_id,product_id,device_unit_id,movement_type,quantity_change,quantity_after,reason,reference_id)
      values(v_business_id,v_product.id,v_device_id,'device_sold',-1,v_after,'Sold on receipt '||v_receipt,v_sale_id);
    else
      update public.products set stock_qty = stock_qty - v_qty, updated_at = now() where id = v_product.id and stock_qty >= v_qty returning stock_qty into v_after;
      if not found then raise exception 'Stock changed during checkout. Refresh and try again.'; end if;
      insert into public.stock_movements(business_id,product_id,movement_type,quantity_change,quantity_after,reason,reference_id)
      values(v_business_id,v_product.id,'sale',-v_qty,v_after,'Sale '||v_receipt,v_sale_id);
    end if;
    insert into public.sale_items(business_id,sale_id,product_id,device_unit_id,item_name,sku,quantity,unit_price,unit_cost,line_total,device_details)
    values(v_business_id,v_sale_id,v_product.id,v_device_id,v_product.name,v_product.sku,v_qty,v_unit_price,
      case when v_product.track_imei then v_device.purchase_cost else v_product.purchase_price end,v_line,v_device_details);
  end loop;
  if v_paid > 0 then
    insert into public.sale_payments(business_id,sale_id,amount,method,reference)
    values(v_business_id,v_sale_id,v_paid,p_payment_method,coalesce(trim(p_payment_reference),''));
  end if;
  return v_sale_id;
end;
$$;

create or replace function public.record_sale_payment(
  p_sale_id uuid, p_amount numeric, p_method text, p_reference text default ''
) returns numeric
language plpgsql security invoker set search_path = public
as $$
declare v_business_id uuid; v_sale public.sales%rowtype; v_balance numeric(12,2); v_paid numeric(12,2);
begin
  select id into v_business_id from public.businesses where owner_id = public.shop_owner();
  select * into v_sale from public.sales where id = p_sale_id and business_id = v_business_id and status = 'completed' for update;
  if not found then raise exception 'Sale not found or no longer payable.'; end if;
  if p_amount <= 0 then raise exception 'Payment amount must be greater than zero.'; end if;
  if p_method not in ('cash','airtel_money','mtn_momo','bank_transfer','card','other') then raise exception 'Choose a valid payment method.'; end if;
  v_balance := v_sale.total - v_sale.amount_paid;
  if p_amount > v_balance then raise exception 'Payment is greater than the remaining balance.'; end if;
  v_paid := v_sale.amount_paid + p_amount;
  update public.sales set amount_paid = v_paid, balance_due = total - v_paid,
    payment_status = case when v_paid = total then 'paid' else 'part_paid' end where id = p_sale_id;
  insert into public.sale_payments(business_id,sale_id,amount,method,reference)
  values(v_business_id,p_sale_id,p_amount,p_method,coalesce(trim(p_reference),''));
  return v_sale.total - v_paid;
end;
$$;

-- Revoke anonymous execution; authenticated users still pass owner/RLS checks.
revoke all on function public.ensure_my_business(text,text,text) from public, anon;
revoke all on function public.add_device_unit(uuid,text,text,text,text,integer,text,numeric) from public, anon;
revoke all on function public.adjust_stock(uuid,integer,text) from public, anon;
revoke all on function public.create_sale(text,text,numeric,jsonb,numeric,text,text,text) from public, anon;
revoke all on function public.record_sale_payment(uuid,numeric,text,text) from public, anon;
grant execute on function public.ensure_my_business(text,text,text) to authenticated;
grant execute on function public.add_device_unit(uuid,text,text,text,text,integer,text,numeric) to authenticated;
grant execute on function public.adjust_stock(uuid,integer,text) to authenticated;
grant execute on function public.create_sale(text,text,numeric,jsonb,numeric,text,text,text) to authenticated;
grant execute on function public.record_sale_payment(uuid,numeric,text,text) to authenticated;

-- Restrict access to public schema tables to authenticated clients only.
grant select, insert, update, delete on public.businesses, public.products, public.device_units,
  public.sales, public.sale_items, public.sale_payments, public.stock_movements, public.expenses to authenticated;
revoke all on public.businesses, public.products, public.device_units, public.sales,
  public.sale_items, public.sale_payments, public.stock_movements, public.expenses from anon;

-- Helpful view: one row per current individual device in stock. RLS on base table is preserved.
create or replace view public.available_device_units with (security_invoker = true) as
select id,business_id,product_id,imei,serial_number,storage,colour,battery_health,device_condition,purchase_cost,created_at
from public.device_units where status = 'in_stock';

-- Grant access to the inventory view only after it has been created.
grant select on public.available_device_units to authenticated;
revoke all on public.available_device_units from anon;
-- TechPoint ZM v0.4 — run ONCE in Supabase SQL Editor (safe to re-run).
-- 1) Allow clothing and shoes as item types
alter table public.products drop constraint if exists products_item_type_check;
alter table public.products add constraint products_item_type_check
  check (item_type in ('phone','accessory','clothing','shoes','other'));

-- 2) Void a sale: returns stock / IMEI phones to inventory and logs it
create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns void language plpgsql security invoker set search_path = public as $$
declare v_sale public.sales%rowtype; v_item record; v_after integer;
begin
  if coalesce(trim(p_reason),'') = '' then raise exception 'A reason is required to void a sale.'; end if;
  select * into v_sale from public.sales
   where id = p_sale_id and status = 'completed'
     and business_id in (select id from public.businesses where owner_id = public.shop_owner()) for update;
  if not found then raise exception 'Sale not found or already voided.'; end if;
  for v_item in select * from public.sale_items where sale_id = p_sale_id loop
    if v_item.device_unit_id is not null then
      update public.device_units set status = 'in_stock', sale_id = null where id = v_item.device_unit_id;
    end if;
    update public.products set stock_qty = stock_qty + v_item.quantity, updated_at = now()
     where id = v_item.product_id returning stock_qty into v_after;
    insert into public.stock_movements(business_id,product_id,device_unit_id,movement_type,quantity_change,quantity_after,reason,reference_id)
    values(v_sale.business_id,v_item.product_id,v_item.device_unit_id,'sale_void',v_item.quantity,v_after,'Voided '||v_sale.receipt_number,p_sale_id);
  end loop;
  update public.sales set status='voided', voided_at=now(), void_reason=trim(p_reason) where id = p_sale_id;
end; $$;

-- TechPoint ZM v0.6 — run ONCE in Supabase → SQL Editor. Safe to re-run. Does NOT touch your data.

-- 1) Cloud product photos (shared by every phone and laptop)
alter table public.products add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "team add product images" on storage.objects;
drop policy if exists "team change product images" on storage.objects;
drop policy if exists "team delete product images" on storage.objects;
create policy "team add product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] in
    (select id::text from public.businesses where owner_id = public.shop_owner()));
create policy "team change product images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] in
    (select id::text from public.businesses where owner_id = public.shop_owner()));
create policy "team delete product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] in
    (select id::text from public.businesses where owner_id = public.shop_owner()));

-- 2) Remove a phone registered by mistake (only while it is still in stock)
create or replace function public.delete_device_unit(p_device_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_dev public.device_units%rowtype; v_qty integer;
begin
  select * into v_dev from public.device_units
   where id = p_device_id and status = 'in_stock'
     and business_id in (select id from public.businesses where owner_id = public.shop_owner()) for update;
  if not found then raise exception 'Phone not found, or it has already been sold.'; end if;
  delete from public.device_units where id = p_device_id;
  update public.products set stock_qty = greatest(stock_qty - 1, 0), updated_at = now()
   where id = v_dev.product_id returning stock_qty into v_qty;
  insert into public.stock_movements(business_id,product_id,movement_type,quantity_change,quantity_after,reason)
  values (v_dev.business_id, v_dev.product_id, 'write_off', -1, coalesce(v_qty,0), 'Phone removed (registration mistake)');
end; $$;
revoke all on function public.delete_device_unit(uuid) from public, anon;
grant execute on function public.delete_device_unit(uuid) to authenticated;

-- TechPoint ZM v2.0 — run ONCE in Supabase → SQL Editor. Safe to re-run. Does NOT touch your data.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  business_id uuid, user_email text, action text not null, table_name text not null,
  row_id text, summary text, created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select to authenticated
  using (business_id in (select id from public.businesses where owner_id = public.shop_owner()));
revoke all on public.audit_log from anon;
grant select on public.audit_log to authenticated;

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare r jsonb; o jsonb; who text; s text; a text;
begin
  r := to_jsonb(coalesce(new, old)); o := to_jsonb(old);
  select email into who from auth.users where id = auth.uid();
  s := coalesce(r->>'name', r->>'receipt_number', r->>'description', '');
  a := lower(tg_op);
  if tg_table_name = 'products' and tg_op = 'UPDATE' then
    if (o->>'is_active') is distinct from (r->>'is_active') then a := case when (r->>'is_active')='true' then 'restored' else 'archived' end; end if;
    if (o->>'selling_price') is distinct from (r->>'selling_price') then s := s || ' · price K' || (o->>'selling_price') || ' → K' || (r->>'selling_price'); end if;
    if (o->>'purchase_price') is distinct from (r->>'purchase_price') then s := s || ' · cost K' || (o->>'purchase_price') || ' → K' || (r->>'purchase_price'); end if;
  elsif tg_table_name = 'sales' and tg_op = 'UPDATE' then
    a := coalesce(r->>'status','updated'); s := s || ' · K' || coalesce(r->>'total','');
  elsif tg_table_name = 'sales' then s := s || ' · K' || coalesce(r->>'total','');
  elsif tg_table_name = 'expenses' then s := s || ' · K' || coalesce(r->>'amount','');
  end if;
  insert into public.audit_log(business_id, user_email, action, table_name, row_id, summary)
  values ((r->>'business_id')::uuid, who, a, tg_table_name, r->>'id', s);
  return coalesce(new, old);
end; $$;

drop trigger if exists trg_audit_products on public.products;
create trigger trg_audit_products after insert or delete or update of name, selling_price, purchase_price, is_active
  on public.products for each row execute function public.log_change();
drop trigger if exists trg_audit_sales on public.sales;
create trigger trg_audit_sales after insert or update of status on public.sales
  for each row execute function public.log_change();
drop trigger if exists trg_audit_expenses on public.expenses;
create trigger trg_audit_expenses after insert or delete on public.expenses
  for each row execute function public.log_change();

-- TechPoint ZM v2.1 — TEAM & ROLES. Run ONCE in Supabase → SQL Editor (safe to re-run). Does NOT touch your shop data.

create table if not exists public.team_members (
  email text primary key,
  display_name text not null default '',
  role text not null default 'cashier' check (role in ('owner','manager','cashier')),
  is_primary boolean not null default false,
  active boolean not null default true,
  added_by text,
  created_at timestamptz not null default now()
);
alter table public.team_members enable row level security;

-- the people you already use (all three become owners; rsmtech19 holds the shop data)
insert into public.team_members(email, display_name, role, is_primary) values
  ('rsmtech19@gmail.com','RSM TechCare','owner',true),
  ('mulengaroy3@gmail.com','Roy Mulenga','owner',false),
  ('anthonymwale20@gmail.com','Anthony Mwale','owner',false)
on conflict (email) do nothing;

create or replace function public.my_email() returns text language sql stable security definer set search_path = public, auth as $$
  select lower(email) from auth.users where id = auth.uid() $$;

create or replace function public.my_role() returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce((select role from public.team_members where lower(email) = public.my_email() and active), 'owner') $$;

create or replace function public.is_team_owner() returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.team_members where lower(email) = public.my_email() and active and role = 'owner') $$;

-- everybody on the active team shares the primary owner's shop
create or replace function public.shop_owner() returns uuid language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select u.id from auth.users u join public.team_members p on lower(p.email) = lower(u.email)
      where p.is_primary and p.active
        and exists (select 1 from public.team_members me where lower(me.email) = public.my_email() and me.active)
      limit 1),
    auth.uid()) $$;

revoke all on function public.my_email(), public.my_role(), public.is_team_owner(), public.shop_owner() from public, anon;
grant execute on function public.my_email(), public.my_role(), public.is_team_owner(), public.shop_owner() to authenticated;

drop policy if exists team_read on public.team_members;
drop policy if exists team_insert on public.team_members;
drop policy if exists team_update on public.team_members;
drop policy if exists team_delete on public.team_members;
create policy team_read   on public.team_members for select to authenticated using (exists (select 1 from public.team_members m where lower(m.email) = public.my_email() and m.active));
create policy team_insert on public.team_members for insert to authenticated with check (public.is_team_owner());
create policy team_update on public.team_members for update to authenticated using (public.is_team_owner());
create policy team_delete on public.team_members for delete to authenticated using (public.is_team_owner() and not is_primary);
revoke all on public.team_members from anon;
grant select, insert, update, delete on public.team_members to authenticated;

-- never lock the shop out: the primary account stays an active owner
create or replace function public.protect_primary() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.is_primary and (new.role <> 'owner' or not new.active or not new.is_primary) then
    raise exception 'The main owner account cannot be demoted or disabled.'; end if;
  return coalesce(new, old);
end; $$;
drop trigger if exists trg_protect_primary on public.team_members;
create trigger trg_protect_primary before update on public.team_members for each row execute function public.protect_primary();

-- cashiers cannot delete records (database-level, not just hidden buttons)
drop policy if exists cashier_no_delete on public.products;
create policy cashier_no_delete on public.products as restrictive for delete to authenticated using (public.my_role() <> 'cashier');
drop policy if exists cashier_no_delete on public.expenses;
create policy cashier_no_delete on public.expenses as restrictive for delete to authenticated using (public.my_role() <> 'cashier');

-- voiding a sale / removing a phone needs manager or owner
create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns void language plpgsql security invoker set search_path = public as $$
declare v_sale public.sales%rowtype; v_item record; v_after integer;
begin
  if public.my_role() = 'cashier' then raise exception 'Only a manager or owner can do this.'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'A reason is required to void a sale.'; end if;
  select * into v_sale from public.sales
   where id = p_sale_id and status = 'completed'
     and business_id in (select id from public.businesses where owner_id = public.shop_owner()) for update;
  if not found then raise exception 'Sale not found or already voided.'; end if;
  for v_item in select * from public.sale_items where sale_id = p_sale_id loop
    if v_item.device_unit_id is not null then
      update public.device_units set status = 'in_stock', sale_id = null where id = v_item.device_unit_id;
    end if;
    update public.products set stock_qty = stock_qty + v_item.quantity, updated_at = now()
     where id = v_item.product_id returning stock_qty into v_after;
    insert into public.stock_movements(business_id,product_id,device_unit_id,movement_type,quantity_change,quantity_after,reason,reference_id)
    values(v_sale.business_id,v_item.product_id,v_item.device_unit_id,'sale_void',v_item.quantity,v_after,'Voided '||v_sale.receipt_number,p_sale_id);
  end loop;
  update public.sales set status='voided', voided_at=now(), void_reason=trim(p_reason) where id = p_sale_id;
end; $$;

create or replace function public.delete_device_unit(p_device_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_dev public.device_units%rowtype; v_qty integer;
begin
  if public.my_role() = 'cashier' then raise exception 'Only a manager or owner can do this.'; end if;
  select * into v_dev from public.device_units
   where id = p_device_id and status = 'in_stock'
     and business_id in (select id from public.businesses where owner_id = public.shop_owner()) for update;
  if not found then raise exception 'Phone not found, or it has already been sold.'; end if;
  delete from public.device_units where id = p_device_id;
  update public.products set stock_qty = greatest(stock_qty - 1, 0), updated_at = now()
   where id = v_dev.product_id returning stock_qty into v_qty;
  insert into public.stock_movements(business_id,product_id,movement_type,quantity_change,quantity_after,reason)
  values (v_dev.business_id, v_dev.product_id, 'write_off', -1, coalesce(v_qty,0), 'Phone removed (registration mistake)');
end; $$;
