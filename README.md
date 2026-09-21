# BizSim

A business-experience simulator — pick a business, pick a location, and survive 24 months of running it. Built with Expo / React Native (SDK 57) so one TypeScript codebase runs on iOS, Android, and the web.

## Getting it running

**Requires Node 20.** Expo SDK 57 fails on Node 18 with `ReferenceError: File is
not defined`. On macOS: `brew install node@20`, or with nvm: `nvm install 20 && nvm use 20`.

```bash
npm install             # ~2 min, pulls Expo + Phaser
npm run server          # terminal 1 - backend on :8787
npx expo start --web    # terminal 2 - game on :8081, opens in your browser
```

Then open <http://localhost:8081>.

**You need both.** The backend holds accounts, per-month trading records, the
leaderboard and streaks. Without it the game still plays, but sign-in is skipped
and the leaderboard is hidden.

### Signing in

The game opens on a sign-in screen asking for an email. The backend does **not
send real mail** — it prints the six-digit code to the terminal running
`npm run server`. Copy it from there. Everything is stored in `server/data.json`
next to the server; delete that file to start clean.

### Other platforms

```bash
npm run ios         # iOS simulator (needs Xcode)
npm run android     # Android emulator
```

The isometric city is web-only; native falls back to a simpler room view.

### Going from local to hosted

`supabase/schema.sql` is the same data model in Postgres. Create a Supabase
project, run that file in its SQL editor, then put the URL and anon key in
`.env` (copy `.env.example`). The client speaks the same API either way, so
nothing else changes — and a hosted backend sends the login code by real email.

### Regenerating the city

Only needed if you change the city layout. Needs Python 3 and Pillow
(`pip install pillow`):

```bash
python3 scripts/build_city.py
```

Source tiles are vendored in `vendor/kenney/` (CC0, from kenney.nl). One cell
grid drives the ground image, building placements, street furniture, traffic
lanes and pedestrian routes — which is why nothing ends up standing in a road.

## The game

An **interactive-fiction business sim**. You design your own proprietor (name, skin, hair) and every month plays out as ~4 visual-novel scenes delivered by a recurring cast: Sam your right hand, Priya your accountant, Tony the supplier rep, Miss June the neighborhood's voice, Mr. Grady the banker, Dee the contractor, Marcus from the gym, Zoe the influencer, Inspector Vega. Characters walk onto the set, talk to you beat by beat (typewriter dialogue, tap to advance), offer 2-3 choices, and react to your pick with a changed expression. You control your owner directly: tap the floor to walk (a real stride, facing the way you go), move between the street, shop floor, back of house, and office through door hotspots or quick-travel tabs. People who need a decision wait in the right room under a bouncing ❗ — walk up and talk. The desk opens the books, the menu board shows the menu, and the month closes when you sit down with your accountant in the office. A 📋 button shows your actual menu — items and live prices that move with your pricing, inflation, and every product line you launch. Every "dashboard button" (pricing, staffing, marketing, investment, debt) is a scene that appears when it's relevant. What you pick is what you earn: neglect bleeds money, sharp operating compounds.

- **5 business paths** × **3 locations**, each a genuinely different economic problem.
- **The clock**: a month closes after 4 decisions or 20 minutes of active play. Away from the app, 1 real day = 1 game month on autopilot (capped at 3 per return) — you come back to a "while you were away" recap.
- **📊 The Books**: one button opens charts, the full P&L, market share, segments, and rivals.
- Runs end at 24 months with a valuation and S–D grade, or at bankruptcy. Auto-saves continuously.

## The economic engine

- **Macro economy**: a Markov business cycle (boom → steady → downturn → recession) drives consumer confidence, inflation, and the central-bank rate anchor. Every nominal figure — rents, wages, tickets, costs — rides the CPI.
- **Customer segments**: locals, commuters, and visitors each have their own price elasticity, marketing response, and fatigue sensitivity; the mix depends on location and each business appeals to them differently.
- **Loyalty stock**: happy customers become regulars who keep coming through competition and downturns — but churn when the concept goes stale or bad press hits.
- **Competitor AI**: named rivals enter when your margins look juicy (especially downtown, especially in booms), ramp up over ~6 months, split contested demand by relative value-for-money, and fold if you out-compete them.
- **Leases & taxes**: rent locks for 12-month terms then re-prices to market; quarterly taxes take 21% of positive profit.
- **Staff morale**: understaffing burns the team out — service quality drops and people quit; bonuses buy it back.
- **Decision events**: supplier contracts, influencer collabs, and bad-press responses interrupt the month with real trade-offs; health inspections arrive with a month's warning and judge your staffing and freshness.

## Balance

`scripts/balance-sim.ts` plays every business × location combo (120 trials each) with three archetypes that actually draw and answer scenario cards: the **miser** (always the cheap option), the **plodder** (always the sensible middle), and the **operator** (reads the situation).

```bash
npx tsx scripts/balance-sim.ts
```

Current state: the miser grades D or goes bankrupt everywhere; the plodder earns B/C and cannot survive downtown; the operator earns A/S. Profit comes from decisions, not from showing up.

## Code map

| Path | What |
|---|---|
| `src/game/config.ts` | All tunable numbers: businesses, locations, segments, prices |
| `src/game/engine.ts` | The monthly simulation, instant actions, scoring |
| `src/game/macro.ts` | Business-cycle Markov chain, inflation, rate anchor |
| `src/game/competitors.ts` | Rival entry/exit and market-share model |
| `src/game/cast.ts` | The recurring characters and the player-avatar options |
| `src/game/decisions.ts` | The scene deck: dialogue + economics for every player lever |
| `src/components/Portrait.tsx` | Parametric SVG character busts with mood expressions |
| `src/components/SceneView.tsx` | Visual-novel scene player: typewriter, choices, reactions |
| `src/components/WorldStage.tsx` | The explorable world: tap-to-walk, rooms, hotspots, waiting NPCs |
| `src/components/Interior.tsx` | Interior sets per business + back of house + the office |
| `src/components/MenuPanel.tsx` | The live menu: prices ride price level + inflation |
| `src/game/menu.ts` | Menu items per business; product lines add NEW items |
| `src/game/narration.ts` | Second-person story text: month opens, recaps, away summaries |
| `src/game/clock.ts` | Month timing: 4 decisions / 20 active minutes / offline days |
| `src/game/events.ts` | Weighted event deck + decision events |
| `src/game/persistence.ts` | AsyncStorage save/continue |
| `src/game/sound.ts` | expo-audio SFX (WAVs in `assets/sfx`, regenerable via a script) |
| `src/components/` | Reactive SVG storefront, animated walkers, charts, ticker |
| `src/screens/` | Setup → Game → End |
| `scripts/balance-sim.ts` | Headless balance harness |

Balance lives almost entirely in `config.ts` — tune there first, then re-run the harness.

