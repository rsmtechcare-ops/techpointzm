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
