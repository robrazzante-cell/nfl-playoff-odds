#!/usr/bin/env -S npx tsx
// Reconstructs (or extends) the weekly odds-over-time history by re-running
// the simulation "as of" each past week. For week W, that means: treat
// every game with week <= W as already decided (its real score), and every
// game with week > W as still to be simulated — exactly what the odds would
// have looked like right after week W's games finished, using only
// information available at that point in time.
//
// Written as a TypeScript file (run via `tsx`, not plain Node) specifically
// so it can import the real simulation/tiebreak/Elo code directly from src/
// instead of duplicating it — unlike the small formula set in
// seed-ratings.mjs, re-implementing this much logic in plain JS would be a
// real correctness risk (two copies of the full engine drifting apart).
//
// Idempotent: re-running only fills in weeks that don't have a snapshot yet,
// so the same command works both for the initial backfill and for the
// weekly scheduled job that adds just the newly-completed week.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_ELO_CONFIG } from '../src/elo/elo'
import { computeCurrentRatings } from '../src/elo/currentRatings'
import { TEAMS_BY_ID } from '../src/data/teams'
import type { EloRatings, Game } from '../src/data/types'
import { runTrial } from '../src/simulation/simulate'
import { aggregateTrials } from '../src/simulation/aggregate'

const TRIALS_PER_SNAPSHOT = 3000

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function simulateAsOfWeek(allGames: Game[], week: number, startingRatings: EloRatings) {
  const completedGames = allGames.filter((g) => g.completed && g.week <= week)
  const remainingGames = allGames.filter((g) => g.week > week)
  const currentRatings = computeCurrentRatings(completedGames, startingRatings, DEFAULT_ELO_CONFIG)

  const trials = []
  for (let i = 0; i < TRIALS_PER_SNAPSHOT; i++) {
    const random = mulberry32((i + 1) * 2654435761)
    const coinToss = (ids: string[]) => ids[Math.floor(random() * ids.length)]
    trials.push(
      runTrial({
        completedGames,
        remainingGames,
        teamsById: TEAMS_BY_ID,
        startingRatings: currentRatings,
        overrides: new Map(),
        mode: 'elo',
        config: DEFAULT_ELO_CONFIG,
        random,
        coinToss,
      })
    )
  }

  return aggregateTrials(trials, Object.keys(TEAMS_BY_ID))
}

async function main() {
  const dataDir = path.resolve(import.meta.dirname, '..', 'public', 'data')
  const historyDir = path.join(dataDir, 'history')
  await mkdir(historyDir, { recursive: true })

  const meta = JSON.parse(await readFile(path.join(dataDir, 'meta.json'), 'utf8'))
  const allGames: Game[] = JSON.parse(await readFile(path.join(dataDir, `schedule-${meta.season}.json`), 'utf8'))
  const seedData = JSON.parse(await readFile(path.join(dataDir, 'seed-ratings.json'), 'utf8'))

  const existing = new Set(
    (await readdir(historyDir).catch(() => [] as string[]))
      .filter((f) => /^week-\d+\.json$/.test(f))
      .map((f) => Number(f.match(/\d+/)![0]))
  )

  // Every week fully in the past (strictly before the current, in-progress week).
  const lastCompleteWeek = meta.currentWeek - 1
  const weeksWritten: number[] = [...existing]

  for (let week = 1; week <= lastCompleteWeek; week++) {
    if (existing.has(week)) continue
    console.log(`Simulating odds as of week ${week}...`)
    const response = simulateAsOfWeek(allGames, week, seedData.ratings)
    const snapshot = {
      week,
      generatedAt: new Date().toISOString(),
      teamOdds: Object.fromEntries(
        Object.entries(response.teamOdds).map(([teamId, odds]) => [teamId, { playoffPct: odds.playoffPct }])
      ),
    }
    const fileName = `week-${String(week).padStart(2, '0')}.json`
    await writeFile(path.join(historyDir, fileName), JSON.stringify(snapshot, null, 2))
    weeksWritten.push(week)
    console.log(`  wrote ${fileName}`)
  }

  weeksWritten.sort((a, b) => a - b)
  await writeFile(path.join(historyDir, 'index.json'), JSON.stringify({ weeks: weeksWritten }, null, 2))
  console.log(`History index now covers weeks: ${weeksWritten.join(', ') || '(none yet)'}`)
}

main().catch((err) => {
  console.error('backfill-history failed:', err)
  process.exitCode = 1
})
