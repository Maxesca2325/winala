-- One match card (same columns as match_cards) for the match page.
create function public.match_card(p_match_id text)
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
  where m.id = p_match_id;
$$;

revoke execute on function public.match_card(text) from public;
grant execute on function public.match_card(text) to anon, authenticated;
