# Competitive WHR

This is a separate, referee-operated skill leaderboard. It does not write normal
match stats, GP, clan points, or automatically rate public/private arena games.

## Deployment

1. Apply migration `0040_competitive_whr.sql` using the normal migration workflow
   (`pnpm --dir server db:migrate`). It creates the competitive tables and Season 1.
   If the tables already exist but contain no seasons, the API initializes Season 1
   on first access. This also supports schema-only development setup; it does not
   replace the migration when tables are missing.
2. Build/deploy the updated API and client, and restart the Discord bot.
3. Register its commands with `pnpm --dir bot register-commands`.
4. Open `/competitive/`, linked directly below Tournament on the home page.
   This is a standalone page with searchable standings, selectable player stats,
   seasons, and a paginated match feed. Old `/stats/?type=whr` links redirect here.

Player stats cover the entire accepted season, not just the displayed match-feed
page. Highest scores win; tied highest scores count as draws. With placements,
the first team wins. Average team placement uses finishing order or score rank.
The ring shows win rate; WHR itself has no fixed maximum. Voided results are excluded.

No live migration or Discord registration is performed by the implementation tests.

## Bot commands

Only members with the configured guild's bot owner role can add or void results;
staff or administrator permissions alone do not grant access. Everyone in the
configured guild can run `/whr_leaderboard`. Owners/administrators can start a new season. These
checks are enforced at runtime, including when Discord displays a command to a
user without permission. All mutations use the authenticated private API.

```
/whr_add mode:Deathmatch teams:2 players_per_team:1
/whr_add mode:Deathmatch teams:4 players_per_team:2
/whr_add mode:Battle Royale teams:6 players_per_team:1
/whr_void match:<match UUID> reason:Incorrect score
/whr_leaderboard
/whr_season name:Season 2
```

Select the mode, enter the team count (2-32), and choose players per team (1-4).
The bot opens a separate form for each team, with one field per player's exact
account slug from their game profile URL. Display names and Discord mentions are
not account slugs. The private API checks each team against real game accounts;
missing/banned accounts and duplicate players are rejected before saving.

Deathmatch forms ask for each team's score (0-1000, with at least one positive
score); equal top scores are draws. Battle Royale forms ask for each team's
finishing place (1 through the team count, without ties). The bot orders BR teams
by placement before submitting to WHR. Optional `date` is the actual UTC match
date, `YYYY-MM-DD`, defaulting to today.

Continue with the next team button, edit the previous team, or cancel. Forms and
corrections are private to their author; the final validated scoreboard is posted
publicly in the same Discord channel after saving. Large scoreboards are split
across messages. The result footer includes the competitive Match ID for voiding.
No main-game match ID is required. Drafts expire after 30 minutes of inactivity
and are lost when the bot restarts; permissions are checked on every interaction.

A reference is generated from the original command ID. Repeated submissions or
save retries for that form use the same idempotency key. After an uncertain save,
the draft is frozen so a retry cannot publish changed teams for an already saved
result. If posting fails after saving, retry the public post from that form;
do not start a second command for the same match. Starting a new command is a new
result, so referees must still avoid separately entering the same match twice.

Use `/whr_void` to cancel an incorrect saved result, then enter a corrected result.
Voided entries and the staff actor/reason remain in the database. New submissions
always enter the current season. Past seasons can be viewed and invalid results
voided, but replacement results should be entered before opening the next season.

Each new season starts from scratch. Historical seasons remain available; there
is no automatic reset schedule, rating carryover, or inactivity decay. Players
become ranked after three accepted matches. Rating display uses 5,000 + 1,000 × the
natural rating (this is not a guaranteed 0–10,000 range). Prior is 2 and w is 0.0215.
Only final scores/placements count; kills and damage do not add bonuses.

## Calculation and storage

The TypeScript engine adapts StarCubey's score and placement likelihoods, summed
team strengths, UTC rating days, Brownian time prior, and tridiagonal Newton solve.
Upstream: https://github.com/StarCubey/whr-rating-calculator at
`cfc01ad5ac1e798b5d708d816cde769c41c7a0c3`. Its MIT notice is in `LICENSE-StarCubey`
and is copied into server builds. Browser globals and file storage are replaced
with typed inputs and PostgreSQL. Display/provisional rules are intentionally
simpler than upstream's uncertainty-based archiving and rating groups.

Every mutation rebuilds the active history for the affected season and publishes
the result atomically. A database advisory lock serializes mutations across API
processes. Read-only repeatable-read transactions keep history and ratings
consistent. Calculation yields between sweeps and fails/rolls back if it cannot
converge. Seasons are capped at 10,000 active matches; old results are never silently
deleted. For larger deployments, benchmark realistic histories and move the solver
to a background worker before raising this cap.

Tests: `pnpm --dir tests exec vitest run src/competitive`.
The opt-in `competitiveDatabase.test.ts` requires `WHR_TEST_DATABASE_URL` pointing
to a disposable PostgreSQL database; it creates and removes its own test schema.
