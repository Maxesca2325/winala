-- Behaviour tests for the credit rules (brief §5). Run after local_stubs.sql + the migration.
-- Every block raises on failure; the run ends with 'ALL TESTS PASSED'.
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAILED: %', label; end if;
  raise notice 'ok: %', label;
end $$;

create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, false);
$$;

-- Users ---------------------------------------------------------------------
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-00000000000a', '+50937123456');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

select pg_temp.check((select credits_balance from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 3,
  'sign-up grants 3 credits');

-- Same phone again (deleted + re-created account): no second gift.
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b2', 'B@example.com');
select pg_temp.check((select credits_balance from public.profiles where id = '00000000-0000-0000-0000-0000000000b2') = 0,
  'free credits granted once per identity (anti multi-account)');

-- Model output ---------------------------------------------------------------
update public.leagues set calibrated = true where id = 'pl';
select public.ingest_prediction(
  jsonb_build_object('id', 'm1', 'league_id', 'pl', 'league_name', 'Premier League', 'home_team', 'Arsenal',
                     'away_team', 'Brentford', 'kickoff_time', (now() + interval '1 day')::text),
  'STANDARD',
  '{"match_id":"m1","probabilities":{"home":0.58,"draw":0.23,"away":0.19},"top_pick":"Victoire Arsenal",
    "markets":{"btts":{"prediction":"Non","confidence":0.56},"over_under_2_5":{"prediction":"Over","confidence":0.54},
                "correct_score":{"prediction":"2-0","confidence":0.12}},
    "value_bet":{"market":"Victoire Arsenal","bookmaker_odds":1.8,"model_fair_odds":1.72,"edge_percent":4.7},
    "key_arguments":["a","b","c"],"risk_level":"Faible"}'::jsonb);
select public.ingest_prediction(
  jsonb_build_object('id', 'm2', 'league_id', 'ucl', 'league_name', 'Ligue des Champions', 'home_team', 'Barcelone',
                     'away_team', 'Inter', 'kickoff_time', (now() + interval '2 day')::text),
  'STANDARD',
  '{"match_id":"m2","probabilities":{"home":0.47,"draw":0.26,"away":0.27},"top_pick":"Victoire Barcelone",
    "markets":{"btts":{"prediction":"Oui","confidence":0.64},"over_under_2_5":{"prediction":"Over","confidence":0.62}},
    "value_bet":{"market":"Victoire Barcelone","bookmaker_odds":2.25,"model_fair_odds":2.13,"edge_percent":5.6},
    "key_arguments":["a","b","c"],"risk_level":"Moyen"}'::jsonb);

select pg_temp.check((select count(*) from public.predictions_results where match_id = 'm1') = 4,
  'tracker rows written before kickoff (incl. exact score)');
select pg_temp.check((select (public.ingest_prediction(
  jsonb_build_object('id', 'm1', 'league_id', 'pl', 'league_name', 'Premier League', 'home_team', 'Arsenal',
                     'away_team', 'Brentford', 'kickoff_time', (now() + interval '1 day')::text),
  'STANDARD', '{"probabilities":{"home":0.1,"draw":0.1,"away":0.8}}'::jsonb) ->> 'stored')::boolean) = false,
  'an analysed match is never recomputed');

-- Unlock --------------------------------------------------------------------
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');

select pg_temp.check((select (public.unlock_match('m1', 'STANDARD') ->> 'charged')::int) = 1, 'standard unlock costs 1');
select pg_temp.check((select (public.unlock_match('m1', 'STANDARD') ->> 'charged')::int) = 0, 'already unlocked costs 0');
select pg_temp.check((select public.unlock_match('m1', 'STANDARD') #> '{content,value_bet}') = 'null'::jsonb,
  'value bet hidden in standard analysis');
select pg_temp.check((select credits_balance from public.profiles) = 2, 'balance 2 after one paid unlock');

select pg_temp.check((select (public.unlock_match('m1', 'DEEP') ->> 'charged')::int) = 1, 'upgrade to DEEP costs the difference');
select pg_temp.check((select public.unlock_match('m1', 'DEEP') #>> '{content,value_bet,market}') = 'Victoire Arsenal',
  'value bet visible in DEEP on calibrated league');
select pg_temp.check((select credits_balance from public.profiles) = 1, 'balance 1 after upgrade');

select pg_temp.check((select (public.unlock_match('m2', 'STANDARD') ->> 'charged')::int) = 1, 'second match costs 1');
select pg_temp.check((select credits_balance from public.profiles) = 0, 'balance 0');
do $$ begin
  perform public.unlock_match('m2', 'DEEP');
  raise exception 'FAILED: should refuse without credits';
exception when others then
  if sqlerrm <> 'INSUFFICIENT_CREDITS' then raise; end if;
  raise notice 'ok: insufficient credits refused';
end $$;

select pg_temp.check((select count(*) from public.user_unlocks) = 2, 'one unlock row per match (UNIQUE user/match)');
do $$ begin
  perform count(*) from public.model_predictions;
  raise exception 'FAILED: model_predictions readable by clients';
exception when insufficient_privilege then raise notice 'ok: model_predictions not readable directly';
end $$;
select pg_temp.check((select count(*) from public.get_public_tracker() where predicted_pick is not null) = 0,
  'tracker hides picks before kickoff');
select pg_temp.check((select count(*) from public.get_public_tracker() where length(commitment) = 64) = 7,
  'tracker shows hash commitments before kickoff');

do $$ begin
  update public.profiles set credits_balance = 999;
  if (select credits_balance from public.profiles) = 999 then raise exception 'FAILED: client changed its balance'; end if;
  raise notice 'ok: client cannot write its balance';
exception when insufficient_privilege then raise notice 'ok: client cannot write its balance';
end $$;

do $$ begin
  perform public.confirm_payment('x', 'MONCASH', 'y', 1);
  raise exception 'FAILED: client could confirm a payment';
exception when insufficient_privilege then raise notice 'ok: clients cannot confirm payments';
end $$;

-- Payment -------------------------------------------------------------------
select pg_temp.check((select (public.create_payment('weekend', 'MONCASH')).amount) = 250, 'price comes from the pack');
reset role;

select pg_temp.check((select public.confirm_payment(reference, 'MONCASH', 'MC-001', 250) ->> 'status'
                      from public.transactions limit 1) = 'COMPLETED', 'payment confirmed');
select pg_temp.check((select public.confirm_payment(reference, 'MONCASH', 'MC-001', 250) ->> 'status'
                      from public.transactions limit 1) = 'ALREADY_PROCESSED', 'webhook retry is idempotent');
select pg_temp.check((select credits_balance from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 15,
  'credited exactly once (+15)');

-- Refund ----------------------------------------------------------------------
update public.matches set status = 'POSTPONED' where id = 'm1';
select pg_temp.check((select credits_balance from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 17,
  'postponed match refunds the 2 credits spent');
update public.matches set status = 'SCHEDULED' where id = 'm1';
update public.matches set status = 'CANCELLED' where id = 'm1';
select pg_temp.check((select credits_balance from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 17,
  'refund happens once');
select pg_temp.check((select count(*) from public.predictions_results where match_id = 'm1' and result = 'VOID') = 4,
  'tracker rows voided');
select pg_temp.check((select sum(delta) from public.credit_ledger where user_id = '00000000-0000-0000-0000-00000000000a') = 17,
  'ledger matches balance');

-- Tracker integrity -------------------------------------------------------------
do $$ begin
  update public.predictions_results set probability = 0.99 where match_id = 'm2' and market = '1X2';
  raise exception 'FAILED: published pick was edited';
exception when others then
  if sqlerrm <> 'TRACKER_IS_IMMUTABLE' then raise; end if;
  raise notice 'ok: published pick is frozen';
end $$;
do $$ begin
  delete from public.predictions_results where match_id = 'm2';
  raise exception 'FAILED: tracker row deleted';
exception when others then
  if sqlerrm <> 'TRACKER_IS_APPEND_ONLY' then raise; end if;
  raise notice 'ok: tracker is append-only';
end $$;

-- Lineup update ----------------------------------------------------------------
select pg_temp.check(public.apply_lineup_update('m2', 'STANDARD', '{"probabilities":{"home":0.5,"draw":0.25,"away":0.25}}'), 'lineup update applied');
select pg_temp.check(not public.apply_lineup_update('m2', 'STANDARD', '{}'), 'lineup update only once');

select 'ALL TESTS PASSED' as result;
