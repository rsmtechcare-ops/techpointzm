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
