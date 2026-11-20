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
