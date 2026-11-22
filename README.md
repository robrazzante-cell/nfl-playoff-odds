# NFL Playoff Odds Simulator

A playoff-odds simulator for the current NFL season — runs 10,000 season
simulations right in your browser, using a FiveThirtyEight-style Elo rating
model and the NFL's official tiebreaking rules, and shows every team's
chances of making the playoffs, winning their division, grabbing the #1 seed
and bye, and winning the Super Bowl. Includes a Cleveland Browns spotlight,
a "what if" picker so you can lock in results for remaining games and see
odds update live, and a "games that matter most" ranking for whichever team
you spotlight.

Live site: _(add your Vercel URL here once deployed — see below)_

## How it's built

- **Frontend:** React + TypeScript + Vite. The whole simulation runs in a Web
  Worker in your browser — nothing is sent to a server.
- **Data:** A GitHub Action fetches the schedule and scores from ESPN's free
  public API on a schedule (daily, plus more often on game days) and commits
  the results as JSON files in `public/data/`. The site just reads those
  files — no backend, no API keys, no server costs.
- **Hosting:** Static site, deployable for free on Vercel (recommended),
  GitHub Pages, or Netlify.

## Running it locally

You'll need [Node.js](https://nodejs.org) installed (version 20 or newer).

```bash
npm install        # install dependencies (only needed once)
npm run dev        # starts a local server, usually at http://localhost:5173
```

Open the URL it prints in your browser. Changes to the code reload
automatically.

To run the automated tests:

```bash
npm test
```

## Refreshing the data by hand

Normally you don't need to do this — the GitHub Action (see below) keeps the
data current automatically once deployed. But you can run any of these
yourself:

```bash
npm run fetch-data        # re-fetch this season's schedule/scores from ESPN
npm run seed-ratings      # recompute each team's starting Elo rating from the last 3 seasons
npm run backfill-history  # add odds snapshots for any completed week that doesn't have one yet
```

## Deploying it (step by step)

These steps get you a free, shareable link. You only need to do this once —
after that, every update happens automatically.

### 1. Put the code on GitHub

1. Go to [github.com/new](https://github.com/new) and create a new repository
   (public or private, either works). Don't check any of the "initialize
   with..." boxes — you already have the code.
2. In your terminal, from this project's folder, run the commands GitHub
   shows you under **"…or push an existing repository from the command
   line"**. They'll look like:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git branch -M main
   git push -u origin main
   ```

### 2. Connect it to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/log in — the easiest
   way is "Continue with GitHub," which also handles step 3 automatically.
2. Click **"Add New... → Project"**.
3. Pick the GitHub repository you just created and click **Import**.
4. Vercel will auto-detect it's a Vite app. Leave the default settings and
   click **Deploy**.
5. After a minute or so, you'll get a live link like
   `https://your-repo-name.vercel.app` — that's your shareable link. Anyone
   with that link can open the site; you don't need to do anything else to
   share it.

From now on, every time anything pushes to the `main` branch on GitHub
(including the automated data updates below), Vercel automatically redeploys
the site with the new data — usually within a minute.

### 3. Let the GitHub Action keep the data fresh

This is already set up in `.github/workflows/` and needs no extra
configuration — GitHub Actions are enabled by default once the code is on
GitHub. Two scheduled jobs:

- **`update-data.yml`** — fetches the latest schedule and scores daily, and
  more frequently on game days (Thursday, Sunday, Monday), then commits and
  pushes the update.
- **`weekly-history-snapshot.yml`** — once a week (Tuesday morning, after
  Monday Night Football), saves a snapshot of that week's odds so the
  "odds over time" chart keeps growing.

You can check these ran successfully under the **Actions** tab on your
GitHub repo. You can also trigger either one manually from that tab (click
the workflow, then **"Run workflow"**) if you ever want an immediate refresh.

### Changing the default spotlighted team

By default the site spotlights the Cleveland Browns. To change it, open
`src/App.tsx` and change this line:

```ts
const [spotlightTeamId, setSpotlightTeamId] = useState(BROWNS_TEAM_ID)
```

to use any other team's id from `src/data/teams.ts` (or just pick a
different team from the dropdown on the live site — that only changes it
for you, not for everyone else).

## Project structure

```
nfl-playoff-odds/
├── .github/workflows/        # scheduled jobs that keep data fresh
├── scripts/                  # data-fetching and simulation scripts (run via Node)
├── public/data/               # the schedule, ratings, and odds-history JSON files
└── src/
    ├── data/                 # team list and shared type definitions
    ├── elo/                  # the Elo rating model
    ├── tiebreakers/          # official NFL tiebreaking procedures
    ├── playoffs/             # seeding and bracket simulation
    ├── simulation/           # the Monte Carlo engine + Web Worker
    ├── state/                # what-if picks <-> URL encoding
    ├── hooks/                # data loading + simulation wiring
    └── components/           # the UI
```

## Notes on accuracy

- Odds use a FiveThirtyEight-style Elo model (not a copy of their exact
  proprietary numbers) with official NFL tiebreaking rules, including the
  "restart after elimination" rule for 3+ way ties. See the comments at the
  top of `src/tiebreakers/tiebreak.ts` for the handful of deliberate,
  documented simplifications (e.g. the "net touchdowns" tiebreaker step,
  which needs scoring-play detail this app's data source doesn't provide —
  it's the second-to-last step before a coin toss, so it almost never
  changes an outcome in practice).
- This is not an official NFL product and isn't affiliated with the NFL,
  ESPN, or FiveThirtyEight.
