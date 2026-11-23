import { LiveMatchList } from "@/components/live-match-list";
import { MatchList } from "@/components/match-list";
import { LIVE } from "@/lib/live";

export default function AppHome() {
  return LIVE ? <LiveMatchList /> : <MatchList />;
}
