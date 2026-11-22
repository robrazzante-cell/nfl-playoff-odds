#!/usr/bin/env node
// Pulls the full NFL regular-season schedule + scores from ESPN's public
// scoreboard endpoint (no API key needed) and writes it to public/data/.
//
// Run manually with:  node scripts/fetch-data.mjs
// Run automatically by .github/workflows/update-data.yml on a schedule.

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const REGULAR_SEASON_WEEKS = 18
const SOURCE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

// NFL season "year" is the year it starts in (the 2026 season runs Sept 2026
// - Feb 2027). Default to the current year, but allow override for testing
// or when running this script before/after the season boundary.
function defaultSeasonYear() {
  const envYear = process.env.NFL_SEASON_YEAR
  if (envYear) return Number(envYear)
  const now = new Date()
  const month = now.getUTCMonth() + 1 // 1-12
  // Jan/Feb still belong to the previous year's season (postseason runs into Feb).
  return month <= 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
}

async function fetchWeek(season, week, seasonType) {
  // Note: ESPN's scoreboard endpoint uses `dates=YYYY` to pick the season year
  // (a `year=` param is silently ignored and returns the current season instead).
  const url = `${SOURCE_URL}?seasontype=${seasonType}&week=${week}&dates=${season}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`ESPN scoreboard request failed for week ${week}: HTTP ${res.status}`)
  }
  return res.json()
}

function normalizeGame(event, week, seasonType) {
  const comp = event.competitions[0]
  const home = comp.competitors.find((c) => c.homeAway === 'home')
  const away = comp.competitors.find((c) => c.homeAway === 'away')
  const completed = Boolean(comp.status?.type?.completed)
  return {
    id: event.id,
    week,
    seasonType,
    date: event.date,
    homeTeamId: home.team.id,
    awayTeamId: away.team.id,
    homeScore: completed && home.score != null ? Number(home.score) : null,
    awayScore: completed && away.score != null ? Number(away.score) : null,
    completed,
  }
}

async function main() {
  const season = defaultSeasonYear()
  console.log(`Fetching ${season} NFL season schedule from ESPN...`)

  const games = []
  let currentWeek = 1

  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
    try {
      const data = await fetchWeek(season, week, 2)
      const events = data.events || []
      for (const event of events) {
        games.push(normalizeGame(event, week, 2))
      }
      console.log(`  Week ${week}: ${events.length} games`)
    } catch (err) {
      console.warn(`  Week ${week}: could not fetch (${err.message}) — skipping`)
    }
  }

  // "Current week" = the week of the first not-yet-completed game. Derived
  // directly from the per-game completed flags we already have, rather than
  // ESPN's separate "current week" endpoint — that endpoint requires calling
  // the scoreboard with no `dates`/`week` param, which (a) only reflects
  // ESPN's live "today", not whatever `season`/`NFL_SEASON_YEAR` this run was
  // actually fetching, and (b) previously got tangled up with the `dates=`
  // parameter in a way that returned a bogus week number. Deriving it from
  // the games we already fetched is simpler and always self-consistent.
  const firstIncomplete = games.find((g) => !g.completed)
  currentWeek = firstIncomplete ? firstIncomplete.week : REGULAR_SEASON_WEEKS

  const outDir = path.resolve(import.meta.dirname, '..', 'public', 'data')
  await mkdir(outDir, { recursive: true })

  const schedulePath = path.join(outDir, `schedule-${season}.json`)
  await writeFile(schedulePath, JSON.stringify(games, null, 2))
  console.log(`Wrote ${games.length} games to ${schedulePath}`)

  const meta = {
    season,
    currentWeek,
    lastUpdated: new Date().toISOString(),
    source: 'ESPN public scoreboard API (site.api.espn.com)',
  }
  const metaPath = path.join(outDir, 'meta.json')
  await writeFile(metaPath, JSON.stringify(meta, null, 2))
  console.log(`Wrote meta to ${metaPath}`)
}

main().catch((err) => {
  console.error('fetch-data failed:', err)
  process.exitCode = 1
})
