// Converts a batch of Monte Carlo trial results into the percentages the UI needs.

import type { SimResponse, TeamAggregateOdds, TrialResult } from '../data/types'

export function aggregateTrials(trials: TrialResult[], teamIds: string[]): SimResponse {
  const playoff: Record<string, number> = {}
  const division: Record<string, number> = {}
  const bye: Record<string, number> = {}
  const confChamp: Record<string, number> = {}
  const superBowl: Record<string, number> = {}
  const seed: Record<string, Record<number, number>> = {}

  for (const teamId of teamIds) {
    playoff[teamId] = 0
    division[teamId] = 0
    bye[teamId] = 0
    confChamp[teamId] = 0
    superBowl[teamId] = 0
    seed[teamId] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
  }

  for (const trial of trials) {
    for (const teamId of teamIds) {
      const teamSeed = trial.seeds[teamId]
      if (teamSeed != null) {
        playoff[teamId]++
        seed[teamId][teamSeed]++
        if (teamSeed === 1) bye[teamId]++
      }
      if (trial.divisionWinners[teamId]) division[teamId]++
    }
    if (trial.conferenceChampion.AFC) confChamp[trial.conferenceChampion.AFC]++
    if (trial.conferenceChampion.NFC) confChamp[trial.conferenceChampion.NFC]++
    if (trial.superBowlWinner) superBowl[trial.superBowlWinner]++
  }

  const n = trials.length
  const pct = (count: number) => (n === 0 ? 0 : (count / n) * 100)

  const teamOdds: Record<string, TeamAggregateOdds> = {}
  for (const teamId of teamIds) {
    const seedPct: Record<number, number> = {}
    for (let s = 1; s <= 7; s++) seedPct[s] = pct(seed[teamId][s])
    teamOdds[teamId] = {
      teamId,
      playoffPct: pct(playoff[teamId]),
      divisionPct: pct(division[teamId]),
      byePct: pct(bye[teamId]),
      seedPct,
      conferenceChampPct: pct(confChamp[teamId]),
      superBowlPct: pct(superBowl[teamId]),
    }
  }

  return { trialsRun: n, teamOdds }
}
