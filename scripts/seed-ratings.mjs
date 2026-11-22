#!/usr/bin/env node
// One-time (or once-a-season) setup script: runs Elo over the previous few
// NFL seasons to produce starting ratings for the current season, and writes
// them to public/data/seed-ratings.json.
//
// This duplicates the small set of Elo formulas from src/elo/elo.ts (rather
// than importing the TypeScript file directly) so it runs on any reasonably
// modern Node version without a build step. If you ever tune the formulas in
// src/elo/elo.ts, update the matching constants/functions here too.
//
// Run with:  node scripts/seed-ratings.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const SOURCE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
const REGULAR_SEASON_WEEKS = 18
const SEASONS_OF_HISTORY = 3

// --- Elo formulas (keep in sync with src/elo/elo.ts) ---
const K_FACTOR = 20
const HOME_FIELD_ADVANTAGE = 55
const MEAN_RATING = 1505
const REVERSION_FACTOR = 1 / 3

function winProbability(homeRating, awayRating) {
  const eloDiff = homeRating + HOME_FIELD_ADVANTAGE - awayRating
  return 1 / (Math.pow(10, -eloDiff / 400) + 1)
}

function movMultiplier(pointDiff, winnerEloDiffPreGame) {
  const absDiff = Math.abs(pointDiff)
  if (absDiff === 0) return 1
  return (Math.log(absDiff + 1) * 2.2) / (0.001 * winnerEloDiffPreGame + 2.2)
}

function updateRatings(homeRating, awayRating, homeScore, awayScore) {
  const eloDiffPreGame = homeRating + HOME_FIELD_ADVANTAGE - awayRating
  const homeWinProbability = winProbability(homeRating, awayRating)
  let homeActual
  if (homeScore > awayScore) homeActual = 1
  else if (homeScore < awayScore) homeActual = 0
  else homeActual = 0.5
  const pointDiff = homeScore - awayScore
  const winnerEloDiff = homeActual >= 0.5 ? eloDiffPreGame : -eloDiffPreGame
  const mult = pointDiff === 0 ? 1 : movMultiplier(pointDiff, winnerEloDiff)
  const shift = K_FACTOR * mult * (homeActual - homeWinProbability)
  return { newHome: homeRating + shift, newAway: awayRating - shift }
}

function revertTowardMean(rating) {
  return rating + REVERSION_FACTOR * (MEAN_RATING - rating)
}
// --- end duplicated Elo formulas ---

function defaultSeasonYear() {
  const envYear = process.env.NFL_SEASON_YEAR
  if (envYear) return Number(envYear)
  const now = new Date()
  const month = now.getUTCMonth() + 1
  return month <= 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
}

async function fetchSeasonGames(season) {
  const games = []
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
    // Note: `dates=YYYY` selects the season year; `year=` is silently ignored.
    const url = `${SOURCE_URL}?seasontype=2&week=${week}&dates=${season}`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  ${season} week ${week}: HTTP ${res.status} — skipping`)
      continue
    }
    const data = await res.json()
    for (const event of data.events || []) {
      const comp = event.competitions[0]
      const home = comp.competitors.find((c) => c.homeAway === 'home')
      const away = comp.competitors.find((c) => c.homeAway === 'away')
      const completed = Boolean(comp.status?.type?.completed)
      if (!completed) continue // only finished games count toward seeding
      games.push({
        date: event.date,
        homeTeamId: home.team.id,
        awayTeamId: away.team.id,
        homeScore: Number(home.score),
        awayScore: Number(away.score),
      })
    }
  }
  games.sort((a, b) => a.date.localeCompare(b.date))
  return games
}

async function main() {
  const currentSeason = defaultSeasonYear()
  const priorSeasons = []
  for (let i = SEASONS_OF_HISTORY; i >= 1; i--) priorSeasons.push(currentSeason - i)

  console.log(`Seeding ratings for ${currentSeason} using ${priorSeasons.join(', ')}...`)

  let ratings = {} // teamId -> rating, populated lazily at MEAN_RATING on first sighting

  for (const season of priorSeasons) {
    console.log(`Processing ${season} season...`)
    const games = await fetchSeasonGames(season)
    console.log(`  ${games.length} completed games`)
    for (const g of games) {
      if (!(g.homeTeamId in ratings)) ratings[g.homeTeamId] = MEAN_RATING
      if (!(g.awayTeamId in ratings)) ratings[g.awayTeamId] = MEAN_RATING
      const { newHome, newAway } = updateRatings(
        ratings[g.homeTeamId],
        ratings[g.awayTeamId],
        g.homeScore,
        g.awayScore
      )
      ratings[g.homeTeamId] = newHome
      ratings[g.awayTeamId] = newAway
    }
    // Revert toward the mean between seasons (including after the final prior
    // season, so these become the starting ratings for the current season).
    for (const teamId of Object.keys(ratings)) {
      ratings[teamId] = revertTowardMean(ratings[teamId])
    }
  }

  const rounded = Object.fromEntries(
    Object.entries(ratings).map(([id, r]) => [id, Math.round(r * 100) / 100])
  )

  const outDir = path.resolve(import.meta.dirname, '..', 'public', 'data')
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, 'seed-ratings.json')
  await writeFile(
    outPath,
    JSON.stringify(
      {
        season: currentSeason,
        seededFrom: priorSeasons,
        generatedAt: new Date().toISOString(),
        ratings: rounded,
      },
      null,
      2
    )
  )
  console.log(`Wrote seed ratings for ${Object.keys(rounded).length} teams to ${outPath}`)
}

main().catch((err) => {
  console.error('seed-ratings failed:', err)
  process.exitCode = 1
})
