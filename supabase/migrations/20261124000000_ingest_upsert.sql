-- Refresh a match's analysis on re-run (odds and markets move before kickoff),
-- while writing the public tracker rows only the first time it is seen.
create or replace function public.ingest_prediction(p_match jsonb, p_type public.analysis_type, p_output jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  mid text := p_match ->> 'id';
  kickoff timestamptz := (p_match ->> 'kickoff_time')::timestamptz;
  is_new boolean;
  probs jsonb := p_output -> 'probabilities';
  top_side text;
  top_p numeric;
begin
  insert into public.matches (id, league_id, league_name, home_team, away_team, kickoff_time, status)
  values (mid, p_match ->> 'league_id', p_match ->> 'league_name', p_match ->> 'home_team',
          p_match ->> 'away_team', kickoff, coalesce((p_match ->> 'status')::public.match_status, 'SCHEDULED'))
  on conflict (id) do update set kickoff_time = excluded.kickoff_time;

  -- xmax = 0 on the returned row means a true INSERT (not an UPDATE).
  insert into public.model_predictions (match_id, analysis_type, content_json)
  values (mid, p_type, p_output)
  on conflict (match_id, analysis_type)
    do update set content_json = excluded.content_json, generated_at = now()
  returning (xmax = 0) into is_new;

  -- Publish the committed tracker picks once, before kickoff, on first sight.
  if is_new and p_type = 'STANDARD' and kickoff > now() then
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

  return jsonb_build_object('match_id', mid, 'stored', is_new);
end;
$$;

revoke execute on function public.ingest_prediction(jsonb, public.analysis_type, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_prediction(jsonb, public.analysis_type, jsonb) to service_role;
