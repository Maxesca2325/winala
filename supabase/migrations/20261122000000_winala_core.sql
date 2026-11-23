-- Winala core schema: credits, unlocks, payments, public tracker.
-- Rules (brief §5): atomic debit, 0 credit when already unlocked, automatic
-- refund on postponed/cancelled, idempotent payment crediting, one lineup update.
--
-- Security model
-- * Every table has RLS. Clients read only their own rows; nobody writes balances directly.
-- * Money and credit changes go through SECURITY DEFINER functions with
--   `set search_path = ''`, explicit auth.uid() checks, and EXECUTE revoked from PUBLIC.
-- * Service-only functions (ingest, payment confirmation) are granted to service_role only.

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────────── Types ─────────────────────────────
create type public.match_status as enum ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED');
create type public.analysis_type as enum ('STANDARD', 'DEEP');
create type public.pay_provider as enum ('MONCASH', 'NATCASH');
create type public.tx_status as enum ('PENDING', 'COMPLETED', 'FAILED');
create type public.pick_result as enum ('WIN', 'LOSS', 'VOID');

-- ───────────────────────────── Tables ─────────────────────────────
create table public.leagues (
  id text primary key,
  name text not null,
  -- Value bets are only shown when the model is calibrated on this league (backtest passed).
  calibrated boolean not null default false
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone_or_email text not null,
  country_code text not null default 'HT',
  credits_balance integer not null default 0 check (credits_balance >= 0),
  referral_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

-- Anti multi-account: free credits are granted once per phone/email, forever,
-- even if the account is deleted and recreated. Only a hash is kept.
create table public.signup_grants (
  identity_hash text primary key,
  granted_at timestamptz not null default now()
);

create table public.matches (
  id text primary key, -- id from the data provider
  league_id text not null references public.leagues (id),
  league_name text not null,
  home_team text not null,
  away_team text not null,
  kickoff_time timestamptz not null,
  status public.match_status not null default 'SCHEDULED',
  updated_at timestamptz not null default now()
);
create index matches_kickoff_idx on public.matches (kickoff_time);
create index matches_league_idx on public.matches (league_id);

-- Cache of the model output. Stored once, read (and charged) many times, never recomputed.
create table public.model_predictions (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches (id) on delete cascade,
  analysis_type public.analysis_type not null,
  content_json jsonb not null,
  is_lineup_updated boolean not null default false,
  generated_at timestamptz not null default now(),
  unique (match_id, analysis_type)
);

create table public.daily_free_match (
  day date primary key, -- Haiti local date
  match_id text not null references public.matches (id) on delete cascade
);
create index daily_free_match_match_idx on public.daily_free_match (match_id);

create table public.user_unlocks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  match_id text not null references public.matches (id) on delete cascade,
  analysis_type public.analysis_type not null,
  credits_spent integer not null default 0 check (credits_spent >= 0),
  unlocked_at timestamptz not null default now(),
  refunded_at timestamptz,
  unique (user_id, match_id)
);
create index user_unlocks_match_idx on public.user_unlocks (match_id);

create table public.credit_packs (
  id text primary key,
  name text not null,
  credits integer not null check (credits > 0),
  price_htg numeric(10, 2) not null check (price_htg > 0),
  active boolean not null default true
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider public.pay_provider not null,
  pack_id text not null references public.credit_packs (id),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'HTG' check (currency = 'HTG'),
  credits_added integer not null check (credits_added > 0),
  status public.tx_status not null default 'PENDING',
  -- Our reference, shown to the user and quoted in the MonCash/NatCash payment.
  reference text not null unique default ('WN-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  -- The provider's own transaction id, set on confirmation. Unique per provider:
  -- one real payment can never credit twice (webhook retries, manual + webhook…).
  external_ref text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (provider, external_ref)
);
create index transactions_user_idx on public.transactions (user_id, created_at desc);
create index transactions_pack_idx on public.transactions (pack_id);

-- Audit trail: every balance change has exactly one ledger row.
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('SIGNUP', 'UNLOCK', 'REFUND', 'PURCHASE', 'ADJUST')),
  ref text,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

-- Public tracker. Rows are written before kickoff and can never be edited,
-- only settled once. A hash commitment proves the pick existed before the match
-- without revealing a paid pick to non-buyers before kickoff.
create table public.predictions_results (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches (id) on delete cascade,
  market text not null,
  predicted_pick text not null,
  probability numeric(5, 4) not null check (probability between 0 and 1),
  result public.pick_result,
  published_at timestamptz not null default now(),
  settled_at timestamptz,
  salt text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  commitment text not null default '',
  unique (match_id, market)
);

create table public.waitlist (
  id bigint generated always as identity primary key,
  contact text not null unique,
  kind text not null check (kind in ('phone', 'email')),
  source text,
  created_at timestamptz not null default now()
);

-- ───────────────────────────── RLS ─────────────────────────────
alter table public.leagues enable row level security;
alter table public.profiles enable row level security;
alter table public.signup_grants enable row level security;
alter table public.matches enable row level security;
alter table public.model_predictions enable row level security;
alter table public.daily_free_match enable row level security;
alter table public.user_unlocks enable row level security;
alter table public.credit_packs enable row level security;
alter table public.transactions enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.predictions_results enable row level security;
alter table public.waitlist enable row level security;

create policy "leagues are public" on public.leagues for select to anon, authenticated using (true);
create policy "matches are public" on public.matches for select to anon, authenticated using (true);
create policy "free match is public" on public.daily_free_match for select to anon, authenticated using (true);
create policy "active packs are public" on public.credit_packs for select to anon, authenticated using (active);

create policy "own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own unlocks" on public.user_unlocks for select to authenticated using ((select auth.uid()) = user_id);
create policy "own transactions" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "own ledger" on public.credit_ledger for select to authenticated using ((select auth.uid()) = user_id);
-- model_predictions, signup_grants, waitlist, predictions_results: no client policy.
-- Predictions are only reachable through unlock_match/get_analysis; the tracker through public_tracker.

-- Supabase grants ALL on new public tables to anon/authenticated by default: start from nothing.
revoke all on public.leagues, public.matches, public.daily_free_match, public.credit_packs,
  public.profiles, public.user_unlocks, public.transactions, public.credit_ledger,
  public.model_predictions, public.signup_grants, public.waitlist, public.predictions_results
  from anon, authenticated;
grant select on public.leagues, public.matches, public.daily_free_match, public.credit_packs to anon, authenticated;
grant select on public.profiles, public.user_unlocks, public.transactions, public.credit_ledger to authenticated;

-- ───────────────────────────── Helpers ─────────────────────────────
create function public.analysis_cost(t public.analysis_type)
returns integer language sql immutable set search_path = '' as $$
  select case t when 'STANDARD' then 1 when 'DEEP' then 2 end;
$$;

create function public.haiti_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Port-au-Prince')::date;
$$;

-- Number-free confidence label shown on locked matches.
create function public.confidence_label(content jsonb)
returns text language sql immutable set search_path = '' as $$
  select case
    when greatest((content #>> '{probabilities,home}')::numeric,
                  (content #>> '{probabilities,draw}')::numeric,
                  (content #>> '{probabilities,away}')::numeric) >= 0.6 then 'élevée'
    when greatest((content #>> '{probabilities,home}')::numeric,
                  (content #>> '{probabilities,draw}')::numeric,
                  (content #>> '{probabilities,away}')::numeric) >= 0.45 then 'moyenne'
    else 'faible' end;
$$;

-- What a buyer of `t` may see: value bet only in DEEP and only on calibrated leagues.
create function public.visible_content(content jsonb, t public.analysis_type, calibrated boolean)
returns jsonb language sql immutable set search_path = '' as $$
  select case when t = 'DEEP' and calibrated then content
              else jsonb_set(content, '{value_bet}', 'null'::jsonb) end;
$$;

-- ───────────────────────────── Sign-up: 3 free credits, once per identity ─────────────────────────────
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ident text := lower(coalesce(nullif(new.phone, ''), new.email, ''));
  granted boolean := false;
begin
  insert into public.profiles (id, phone_or_email) values (new.id, ident);
  if ident <> '' then
    insert into public.signup_grants (identity_hash)
    values (encode(extensions.digest(ident, 'sha256'), 'hex'))
    on conflict do nothing;
    granted := found;
  end if;
  if granted then
    update public.profiles set credits_balance = credits_balance + 3 where id = new.id;
    insert into public.credit_ledger (user_id, delta, reason) values (new.id, 3, 'SIGNUP');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────── Unlock (atomic debit) ─────────────────────────────
-- One SQL transaction: lock the user's profile row, check ownership, debit,
-- record the unlock. Concurrent calls for the same user queue on the row lock,
-- so a double tap on a slow connection debits once.
create function public.unlock_match(p_match_id text, p_type public.analysis_type default 'STANDARD')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m public.matches%rowtype;
  calibrated boolean;
  bal integer;
  owned public.user_unlocks%rowtype;
  is_free boolean;
  target public.analysis_type := p_type;
  cost integer;
  pred public.model_predictions%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into m from public.matches where id = p_match_id;
  if not found then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002';
  end if;
  select l.calibrated into calibrated from public.leagues l where l.id = m.league_id;

  select credits_balance into bal from public.profiles where id = uid for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into owned from public.user_unlocks where user_id = uid and match_id = p_match_id;

  -- Already owned (same or higher tier): show it, charge nothing. Works after kickoff too.
  if owned.id is not null and (owned.analysis_type = 'DEEP' or owned.analysis_type = p_type) then
    target := owned.analysis_type;
    cost := 0;
  else
    if m.status <> 'SCHEDULED' or m.kickoff_time <= now() then
      raise exception 'MATCH_NOT_AVAILABLE' using errcode = 'P0001';
    end if;

    is_free := exists (
      select 1 from public.daily_free_match f where f.match_id = p_match_id and f.day = public.haiti_today()
    );
    if is_free then
      target := 'DEEP';
      cost := 0;
    else
      cost := public.analysis_cost(p_type) - coalesce(public.analysis_cost(owned.analysis_type), 0);
    end if;

    if bal < cost then
      raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
    end if;
  end if;

  -- DEEP falls back to the STANDARD output when no separate deep report exists.
  select * into pred from public.model_predictions
  where match_id = p_match_id and analysis_type in ('STANDARD', target)
  order by (analysis_type = target) desc limit 1;
  if not found then
    raise exception 'ANALYSIS_NOT_READY' using errcode = 'P0001';
  end if;

  if cost > 0 or owned.id is null or owned.analysis_type <> target then
    update public.profiles set credits_balance = credits_balance - cost where id = uid;
    insert into public.user_unlocks (user_id, match_id, analysis_type, credits_spent)
    values (uid, p_match_id, target, cost)
    on conflict (user_id, match_id) do update
      set analysis_type = excluded.analysis_type,
          credits_spent = public.user_unlocks.credits_spent + excluded.credits_spent;
    if cost > 0 then
      insert into public.credit_ledger (user_id, delta, reason, ref) values (uid, -cost, 'UNLOCK', p_match_id);
    end if;
  end if;

  return jsonb_build_object(
    'match_id', p_match_id,
    'analysis_type', target,
    'charged', cost,
    'balance', bal - cost,
    'is_lineup_updated', pred.is_lineup_updated,
    'content', public.visible_content(pred.content_json, target, coalesce(calibrated, false))
  );
end;
$$;

-- Read an analysis the user already owns (or today's free match). Never charges.
create function public.get_analysis(p_match_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t public.analysis_type;
  calibrated boolean;
  pred public.model_predictions%rowtype;
begin
  select u.analysis_type into t from public.user_unlocks u where u.user_id = uid and u.match_id = p_match_id;
  if t is null and exists (
    select 1 from public.daily_free_match f where f.match_id = p_match_id and f.day = public.haiti_today()
  ) then
    t := 'DEEP';
  end if;
  if t is null then
    return jsonb_build_object('locked', true);
  end if;
  select l.calibrated into calibrated
  from public.matches mm join public.leagues l on l.id = mm.league_id where mm.id = p_match_id;
  select * into pred from public.model_predictions
  where match_id = p_match_id and analysis_type in ('STANDARD', t)
  order by (analysis_type = t) desc limit 1;
  if not found then
    return jsonb_build_object('locked', false, 'ready', false);
  end if;
  return jsonb_build_object(
    'locked', false,
    'analysis_type', t,
    'is_lineup_updated', pred.is_lineup_updated,
    'content', public.visible_content(pred.content_json, t, coalesce(calibrated, false))
  );
end;
$$;

-- Match list for the dashboard: confidence only, no numbers.
create function public.match_cards(p_from timestamptz, p_to timestamptz)
returns table (
  id text, league_id text, league_name text, home_team text, away_team text,
  kickoff_time timestamptz, status public.match_status,
  confidence text, has_value_bet boolean, is_free boolean, unlocked public.analysis_type
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.league_id, m.league_name, m.home_team, m.away_team, m.kickoff_time, m.status,
         public.confidence_label(p.content_json),
         coalesce(l.calibrated and (p.content_json #>> '{value_bet,edge_percent}')::numeric > 0, false),
         exists (select 1 from public.daily_free_match f where f.match_id = m.id and f.day = public.haiti_today()),
         (select u.analysis_type from public.user_unlocks u where u.user_id = auth.uid() and u.match_id = m.id)
  from public.matches m
  join public.leagues l on l.id = m.league_id
  left join public.model_predictions p on p.match_id = m.id and p.analysis_type = 'STANDARD'
  where m.kickoff_time >= p_from and m.kickoff_time < p_to
  order by m.kickoff_time, m.id
  limit 300;
$$;

-- ───────────────────────────── Automatic refund ─────────────────────────────
create function public.refund_match(p_match_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n integer := 0;
begin
  -- Lock unrefunded unlocks; refunded_at makes a second call a no-op (idempotent).
  for r in
    select id, user_id, credits_spent from public.user_unlocks
    where match_id = p_match_id and refunded_at is null
    for update
  loop
    if r.credits_spent > 0 then
      update public.profiles set credits_balance = credits_balance + r.credits_spent where id = r.user_id;
      insert into public.credit_ledger (user_id, delta, reason, ref) values (r.user_id, r.credits_spent, 'REFUND', p_match_id);
    end if;
    update public.user_unlocks set refunded_at = now() where id = r.id;
    n := n + 1;
  end loop;
  update public.predictions_results set result = 'VOID', settled_at = now()
  where match_id = p_match_id and result is null;
  return n;
end;
$$;

create function public.on_match_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('POSTPONED', 'CANCELLED') and old.status not in ('POSTPONED', 'CANCELLED', 'FINISHED') then
    perform public.refund_match(new.id);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- BEFORE so updated_at is set in the same write; refund runs in the same transaction.
create trigger match_status_change
  before update of status on public.matches
  for each row when (old.status is distinct from new.status)
  execute function public.on_match_status_change();

-- ───────────────────────────── Payments ─────────────────────────────
-- Client creates a PENDING transaction. Price and credits come from the pack, never from the client.
create function public.create_payment(p_pack_id text, p_provider public.pay_provider)
returns public.transactions language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  pk public.credit_packs%rowtype;
  tx public.transactions%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select * into pk from public.credit_packs where id = p_pack_id and active;
  if not found then
    raise exception 'PACK_NOT_FOUND' using errcode = 'P0002';
  end if;
  if (select count(*) from public.transactions
      where user_id = uid and status = 'PENDING' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'TOO_MANY_PENDING' using errcode = 'P0001';
  end if;
  insert into public.transactions (user_id, provider, pack_id, amount, credits_added)
  values (uid, p_provider, pk.id, pk.price_htg, pk.credits)
  returning * into tx;
  return tx;
end;
$$;

-- Called by the payment webhook (aggregator) or by an operator after a manual
-- MonCash/NatCash check. Idempotent on both our reference and the provider's id.
create function public.confirm_payment(
  p_reference text, p_provider public.pay_provider, p_external_ref text, p_amount numeric
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  tx public.transactions%rowtype;
begin
  if p_external_ref is null or length(p_external_ref) = 0 then
    raise exception 'EXTERNAL_REF_REQUIRED' using errcode = '22023';
  end if;

  -- Same provider payment already used (possibly for another reference): never credit again.
  if exists (select 1 from public.transactions
             where provider = p_provider and external_ref = p_external_ref and status = 'COMPLETED') then
    return jsonb_build_object('status', 'ALREADY_PROCESSED');
  end if;

  select * into tx from public.transactions where reference = p_reference for update;
  if not found then
    return jsonb_build_object('status', 'UNKNOWN_REFERENCE');
  end if;
  if tx.status = 'COMPLETED' then
    return jsonb_build_object('status', 'ALREADY_PROCESSED');
  end if;
  if tx.provider <> p_provider then
    return jsonb_build_object('status', 'PROVIDER_MISMATCH');
  end if;
  if p_amount < tx.amount then
    update public.transactions set status = 'FAILED', external_ref = p_external_ref where id = tx.id;
    return jsonb_build_object('status', 'AMOUNT_MISMATCH', 'expected', tx.amount, 'received', p_amount);
  end if;

  update public.transactions
  set status = 'COMPLETED', external_ref = p_external_ref, completed_at = now()
  where id = tx.id;
  update public.profiles set credits_balance = credits_balance + tx.credits_added where id = tx.user_id;
  insert into public.credit_ledger (user_id, delta, reason, ref) values (tx.user_id, tx.credits_added, 'PURCHASE', tx.reference);
  return jsonb_build_object('status', 'COMPLETED', 'credits_added', tx.credits_added);
end;
$$;

-- ───────────────────────────── Model ingestion ─────────────────────────────
-- Stores a model output once (never recomputed) and writes the tracker rows
-- before kickoff. Called by the ingest-predictions Edge Function.
create function public.ingest_prediction(p_match jsonb, p_type public.analysis_type, p_output jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  mid text := p_match ->> 'id';
  kickoff timestamptz := (p_match ->> 'kickoff_time')::timestamptz;
  inserted boolean;
  probs jsonb := p_output -> 'probabilities';
  top_side text;
  top_p numeric;
begin
  insert into public.matches (id, league_id, league_name, home_team, away_team, kickoff_time, status)
  values (mid, p_match ->> 'league_id', p_match ->> 'league_name', p_match ->> 'home_team',
          p_match ->> 'away_team', kickoff, coalesce((p_match ->> 'status')::public.match_status, 'SCHEDULED'))
  on conflict (id) do update set kickoff_time = excluded.kickoff_time, status = excluded.status;

  insert into public.model_predictions (match_id, analysis_type, content_json)
  values (mid, p_type, p_output)
  on conflict (match_id, analysis_type) do nothing;
  inserted := found;

  if inserted and p_type = 'STANDARD' and kickoff > now() then
    select key, value::numeric into top_side, top_p
    from jsonb_each_text(probs) order by value::numeric desc limit 1;
    insert into public.predictions_results (match_id, market, predicted_pick, probability) values
      (mid, '1X2', case top_side when 'home' then p_match ->> 'home_team'
                                 when 'away' then p_match ->> 'away_team' else 'Nul' end, top_p),
      (mid, 'BTTS', p_output #>> '{markets,btts,prediction}', (p_output #>> '{markets,btts,confidence}')::numeric),
      (mid, 'Plus/Moins 2,5', p_output #>> '{markets,over_under_2_5,prediction}',
            (p_output #>> '{markets,over_under_2_5,confidence}')::numeric)
    on conflict (match_id, market) do nothing;
  end if;

  return jsonb_build_object('match_id', mid, 'stored', inserted);
end;
$$;

-- H-1 lineup update: replaces the prediction ONCE. Buyers see it free (same unlock).
create function public.apply_lineup_update(p_match_id text, p_type public.analysis_type, p_output jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.model_predictions
  set content_json = p_output, is_lineup_updated = true, generated_at = now()
  where match_id = p_match_id and analysis_type = p_type and not is_lineup_updated;
  return found;
end;
$$;

create function public.settle_prediction(p_match_id text, p_market text, p_result public.pick_result)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.predictions_results set result = p_result, settled_at = now()
  where match_id = p_match_id and market = p_market and result is null;
  return found;
end;
$$;

-- ───────────────────────────── Tracker integrity ─────────────────────────────
create function public.tracker_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  kickoff timestamptz;
begin
  if tg_op = 'INSERT' then
    select kickoff_time into kickoff from public.matches where id = new.match_id;
    new.published_at := now();
    if kickoff is null or new.published_at >= kickoff then
      raise exception 'TRACKER_MUST_PRECEDE_KICKOFF' using errcode = 'P0001';
    end if;
    new.result := null;
    new.settled_at := null;
    new.commitment := encode(extensions.digest(
      new.match_id || '|' || new.market || '|' || new.predicted_pick || '|' || new.probability::text || '|' || new.salt,
      'sha256'), 'hex');
    return new;
  end if;
  -- UPDATE: the published pick is frozen; a result can be set once.
  if new.match_id <> old.match_id or new.market <> old.market or new.predicted_pick <> old.predicted_pick
     or new.probability <> old.probability or new.published_at <> old.published_at
     or new.salt <> old.salt or new.commitment <> old.commitment then
    raise exception 'TRACKER_IS_IMMUTABLE' using errcode = 'P0001';
  end if;
  if old.result is not null and new.result is distinct from old.result then
    raise exception 'TRACKER_ALREADY_SETTLED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger tracker_guard
  before insert or update on public.predictions_results
  for each row execute function public.tracker_guard();

create function public.tracker_no_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'TRACKER_IS_APPEND_ONLY' using errcode = 'P0001';
end;
$$;

create trigger tracker_no_delete
  before delete on public.predictions_results
  for each row execute function public.tracker_no_delete();

-- Public view: full pick after kickoff; before kickoff only the hash commitment,
-- so the free tracker never gives away a paid pick.
create view public.public_tracker
with (security_barrier = true) as
select
  r.id::text as id,
  r.match_id,
  r.market,
  case when m.kickoff_time <= now() then r.predicted_pick end as predicted_pick,
  case when m.kickoff_time <= now() then r.probability end as probability,
  r.result,
  r.published_at,
  r.settled_at,
  r.commitment,
  case when m.kickoff_time <= now() then r.salt end as salt,
  m.home_team,
  m.away_team,
  m.league_name,
  m.kickoff_time
from public.predictions_results r
join public.matches m on m.id = r.match_id;
-- Owned by postgres (security definer semantics) on purpose: it is the ONLY
-- public window on predictions_results and exposes nothing pre-kickoff.
revoke all on public.public_tracker from anon, authenticated;
grant select on public.public_tracker to anon, authenticated;

-- ───────────────────────────── Function privileges ─────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.unlock_match(text, public.analysis_type) to authenticated;
grant execute on function public.get_analysis(text) to authenticated;
grant execute on function public.create_payment(text, public.pay_provider) to authenticated;
grant execute on function public.match_cards(timestamptz, timestamptz) to anon, authenticated;

grant execute on function public.confirm_payment(text, public.pay_provider, text, numeric) to service_role;
grant execute on function public.ingest_prediction(jsonb, public.analysis_type, jsonb) to service_role;
grant execute on function public.apply_lineup_update(text, public.analysis_type, jsonb) to service_role;
grant execute on function public.settle_prediction(text, text, public.pick_result) to service_role;
grant execute on function public.refund_match(text) to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ───────────────────────────── Seed ─────────────────────────────
insert into public.leagues (id, name, calibrated) values
  ('pl', 'Premier League', false),
  ('liga', 'La Liga', false),
  ('seriea', 'Serie A', false),
  ('l1', 'Ligue 1', false),
  ('ucl', 'Ligue des Champions', false);
-- Leagues start NOT calibrated: flip to true only after the backtest passes (brief §6).

insert into public.credit_packs (id, name, credits, price_htg) values
  ('decouverte', 'Découverte', 5, 100),
  ('weekend', 'Week-end', 15, 250),
  ('pro', 'Pro', 40, 500);
