-- Waitlist sign-up callable from the browser (the site can then be fully static).
-- Validates input server-side; duplicates are accepted silently (no enumeration).
create function public.join_waitlist(p_contact text, p_kind text, p_source text default 'landing')
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  c text := lower(trim(p_contact));
begin
  if p_kind = 'phone' then
    if c !~ '^\+509[2-5][0-9]{7}$' then raise exception 'INVALID_CONTACT' using errcode = '22023'; end if;
  elsif p_kind = 'email' then
    if length(c) > 254 or c !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'INVALID_CONTACT' using errcode = '22023'; end if;
  else
    raise exception 'INVALID_CONTACT' using errcode = '22023';
  end if;
  insert into public.waitlist (contact, kind, source)
  values (c, p_kind, left(coalesce(p_source, 'landing'), 40))
  on conflict (contact) do nothing;
  return true;
end;
$$;

revoke execute on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
