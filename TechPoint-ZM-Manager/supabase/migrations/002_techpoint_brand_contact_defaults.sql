-- TechPoint ZM v0.2: first-run contact defaults.
-- Run this only if the Supabase schema was already deployed using the earlier package.
-- It preserves every non-empty business phone/email already saved by the owner.
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
  select id into v_id from public.businesses where owner_id = auth.uid() limit 1;
  if v_id is null then
    insert into public.businesses(owner_id, business_name, phone, email)
    values (auth.uid(), coalesce(nullif(trim(p_business_name), ''), 'TechPoint ZM'), coalesce(nullif(trim(p_phone), ''), ''), coalesce(nullif(trim(p_email), ''), ''))
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
revoke all on function public.ensure_my_business(text,text,text) from public, anon;
grant execute on function public.ensure_my_business(text,text,text) to authenticated;
