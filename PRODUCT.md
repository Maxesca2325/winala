# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, installable PWA (manifest + service worker). Backend: Supabase (Postgres, Auth by phone +509 or email, Edge Functions, RPC). Pinned by the brief (`winala-brief-handoff.md`). Supabase is delivered as SQL migrations and Edge Function code only; nothing is created on a live project yet (user's choice, 2026-11-22).

## Users

Football fans in Haiti, on entry-level Android phones, on unstable 3G/4G and expensive data. They follow the big European leagues (Premier League, La Liga, Serie A, Ligue 1, Champions League), talk about matches with friends, and many bet small amounts at local borlette/sport shops. They want a sharper read on a match before kickoff, quickly, in French, priced in HTG.

## Product Purpose

Winala is a statistical analysis assistant for football matches. A statistical model (Dixon-Coles / Poisson with xG) computes every number: 1X2 probabilities, BTTS, Over/Under 2.5, value bet edge. The app shows those numbers with three template-written arguments and a risk level. Success = users trust the numbers because a public, timestamped track record proves them, and they spend credits to unlock analyses.

## Positioning

Honest probabilities, not tips. Every pick is published with a timestamp before kickoff and settled in a public tracker anyone can see without an account. No guaranteed scores, no promised winnings. Numbers come from a model, never from an LLM.

## Operating Context

- Mobile-first, very light pages; must work on slow and dropping connections.
- Credits only (no subscription in v1): 3 free credits at sign-up. Packs in HTG: Découverte 5 cr / 100 HTG, Week-end 15 cr / 250 HTG, Pro 40 cr / 500 HTG. 1 credit = standard analysis, 2 credits = deep Value Bet report.
- One match per day is fully free ("prono du jour"), meant to be shared on the AyitiSport page.
- Locked matches show only a vague confidence level; numbers hidden.
- Payment: MonCash and NatCash, HTG. No clean gateway/webhook in Haiti: aggregator or manual confirmation, with idempotent crediting.
- Refund automatically when a match is postponed or cancelled. No refund on a losing pick.
- Lineup update at H-1: prediction regenerated once, free for those who unlocked.

## Capabilities and Constraints

- Build order: (1) landing + waitlist, (2) app shell with demo data labelled « exemple », (3) Supabase backend, (4) validated model + real data, (5) payment.
- The model is not validated yet (backtest pending, done outside this codebase in Python). The front only consumes its JSON output.
- Value Bet box shown only when real and the league is calibrated.
- No API keys on the client.
- Language: French only at launch (user's choice). Kreyòl later.
- Market: Haiti only at launch; francophone Africa later on the same engine.

## Brand Commitments

- Name: Winala. No existing logo, palette or type: identity to be created (user's choice).
- Voice: French, direct, sober, numerate. Says "probabilité", "analyse statistique", never "gagnant assuré".
- AyitiSport is a distribution partner page for the free daily pick.
- Visual direction (user's choice, 2026-11-22): the familiar sports-app path, executed at full craft; FotMob is the quality bar. See DESIGN.md.

## Evidence on Hand

- No real predictions, results, users, testimonials or win rate exist yet. The public tracker must stay empty until real picks are settled.
- Any demo match or number must be labelled « exemple ».
- No partner logos, press or customer quotes exist.

## Product Principles

1. The model makes the numbers; words only explain them.
2. Proof before paywall: the track record is public and comes first.
3. Never a promise of winnings; risk is always stated.
4. Every kilobyte costs the user money: ship less.
5. Fair credit: never charge twice, refund when no match is played.

## Accessibility & Inclusion

Low-end Android, small screens (360px wide), outdoor sunlight, data-saver mode. WCAG AA contrast, large tap targets, works without JavaScript-heavy effects, legible numerals.
