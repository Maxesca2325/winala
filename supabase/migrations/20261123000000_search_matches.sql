-- Search any upcoming analysed match by team name (number-free, like match_cards).
-- The analysis itself is already cached in model_predictions; this only finds it.
create function public.search_matches(p_query text)
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
  join public.model_predictions p on p.match_id = m.id and p.analysis_type = 'STANDARD'
  where m.status = 'SCHEDULED' and m.kickoff_time > now()
    and length(btrim(p_query)) >= 2
    and (m.home_team ilike '%' || btrim(p_query) || '%' or m.away_team ilike '%' || btrim(p_query) || '%'
         or m.league_name ilike '%' || btrim(p_query) || '%')
  order by m.kickoff_time, m.id
  limit 40;
$$;

revoke execute on function public.search_matches(text) from public;
grant execute on function public.search_matches(text) to anon, authenticated;
