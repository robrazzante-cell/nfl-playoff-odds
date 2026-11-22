import { describe, expect, it } from 'vitest'
import type { Game, Team } from '../data/types'
import { buildGameLogs } from '../tiebreakers/stats'
import type { TiebreakContext } from '../tiebreakers/tiebreak'
import { seedConference } from './seeding'

// A minimal but complete AFC: 4 divisions of 4 teams, with each team's
// overall win pct distinct enough to avoid ties (tie handling is already
// covered by the tiebreak test suite) so this test can focus purely on
// seeding mechanics: division winners get 1-4, the rest compete for 5-7.
function team(id: string, division: 'East' | 'North' | 'South' | 'West'): Team {
  return {
    id,
    abbr: id,
    name: id,
    location: id,
    conference: 'AFC',
    division,
    colorPrimary: '#000',
    colorSecondary: '#fff',
  }
}

let nextId = 1
function game(home: string, away: string, homeScore: number, awayScore: number): Game {
  return {
    id: `g${nextId++}`,
    week: 1,
    seasonType: 2,
    date: '2024-01-01',
    homeTeamId: home,
    awayTeamId: away,
    homeScore,
    awayScore,
    completed: true,
  }
}

describe('seedConference', () => {
  it('seeds division winners 1-4 ahead of every non-division-winner', () => {
    // Division winners, strongest to weakest: E1 (13-4), N1 (12-5), S1 (11-6), W1 (10-7).
    // Best non-division-winner (a wild card) only goes 9-8 -- still worse than every division winner.
    const divisions: Record<string, [string, string, string, string]> = {
      East: ['E1', 'E2', 'E3', 'E4'],
      North: ['N1', 'N2', 'N3', 'N4'],
      South: ['S1', 'S2', 'S3', 'S4'],
      West: ['W1', 'W2', 'W3', 'W4'],
    }
    const teamsById: Record<string, Team> = {}
    for (const [division, ids] of Object.entries(divisions)) {
      for (const id of ids) teamsById[id] = team(id, division as 'East' | 'North' | 'South' | 'West')
    }
    // A shared opponent outside the AFC, used only to give each team an
    // independently-controllable win total (so no two teams' records are
    // coupled by having played each other).
    const FILLER = 'FILLER'
    teamsById[FILLER] = { ...team(FILLER, 'East'), conference: 'NFC' }

    const winRecords: Record<string, number> = {
      E1: 13, N1: 12, S1: 11, W1: 10, // division winners
      E2: 9, N2: 8, S2: 7, W2: 6, // wild-card contenders, E2 is the best of the rest
      E3: 5, N3: 4, S3: 3, W3: 2,
      E4: 1, N4: 1, S4: 0, W4: 0,
    }

    // Give each team exactly as many wins against the shared filler team as
    // winRecords says, out of 17 games, so win pct is directly comparable.
    const games: Game[] = []
    for (const [teamId, wins] of Object.entries(winRecords)) {
      for (let i = 0; i < wins; i++) games.push(game(teamId, FILLER, 24, 10))
      for (let i = 0; i < 17 - wins; i++) games.push(game(FILLER, teamId, 24, 10))
    }

    const logs = buildGameLogs(games, teamsById)
    const ctx: TiebreakContext = { logs, teamsById, random: { coinToss: (ids) => ids[0] } }

    const result = seedConference('AFC', teamsById, ctx)

    expect(result.seeds).toHaveLength(7)
    expect(result.divisionWinners).toEqual(new Set(['E1', 'N1', 'S1', 'W1']))
    // Seeds 1-4 are the division winners, ordered by record.
    expect(result.seeds.slice(0, 4)).toEqual(['E1', 'N1', 'S1', 'W1'])
    // Seed 5 is the best non-division-winner.
    expect(result.seeds[4]).toBe('E2')
  })
})
