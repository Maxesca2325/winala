export interface TrackerRow {
  id: string;
  match_id: string;
  market: string;
  /** null until kickoff: only the hash commitment is public before the match. */
  predicted_pick: string | null;
  probability: number | null;
  commitment: string;
  salt: string | null;
  result: "WIN" | "LOSS" | "VOID" | null;
  published_at: string;
  settled_at: string | null;
  home_team: string;
  away_team: string;
  league_name: string;
  kickoff_time: string;
}
