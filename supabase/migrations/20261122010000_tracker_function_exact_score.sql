-- 1. Replace the SECURITY DEFINER view (Supabase advisor 0010) with a function
--    that exposes exactly the same columns. Before kickoff: hash only.
-- 2. Track the exact-score pick in the public record.

drop view if exists public.public_tracker;

create function public.get_public_tracker(p_limit integer default 200)
returns table (
  id text, match_id text, market text, predicted_pick text, probability numeric,
  result public.pick_result, published_at timestamptz, settled_at timestamptz,
  commitment text, salt text, home_team text, away_team text, league_name text, kickoff_time timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    r.id::text, r.match_id, r.market,
    case when m.kickoff_time <= now() then r.predicted_pick end,
    case when m.kickoff_time <= now() then r.probability end,
    r.result, r.published_at, r.settled_at, r.commitment,
    case when m.kickoff_time <= now() then r.salt end,
    m.home_team, m.away_team, m.league_name, m.kickoff_time
  from public.predictions_results r
  join public.matches m on m.id = r.match_id
  order by m.kickoff_time desc, r.id
  limit least(greatest(p_limit, 1), 500);
$$;

revoke execute on function public.get_public_tracker(integer) from public;
grant execute on function public.get_public_tracker(integer) to anon, authenticated;

create or replace function public.ingest_prediction(p_match jsonb, p_type public.analysis_type, p_output jsonb)
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
    if p_output #> '{markets,correct_score}' is not null then
      insert into public.predictions_results (match_id, market, predicted_pick, probability)
      values (mid, 'Score exact', p_output #>> '{markets,correct_score,prediction}',
              (p_output #>> '{markets,correct_score,confidence}')::numeric)
      on conflict (match_id, market) do nothing;
    end if;
  end if;

  return jsonb_build_object('match_id', mid, 'stored', inserted);
end;
$$;

revoke execute on function public.ingest_prediction(jsonb, public.analysis_type, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_prediction(jsonb, public.analysis_type, jsonb) to service_role;
