import { describe, expect, it } from 'vitest'
import type { Game, Team } from '../data/types'
import { buildGameLogs, combinedRank, commonOpponents, netPoints, winPct } from './stats'

let nextGameId = 1
function game(homeTeamId: string, awayTeamId: string, homeScore: number, awayScore: number): Game {
  return {
    id: `g${nextGameId++}`,
    week: 1,
    seasonType: 2,
    date: '2024-01-01',
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    completed: true,
  }
}

function team(id: string): Team {
  return {
    id,
    abbr: id,
    name: id,
    location: id,
    conference: 'AFC',
    division: 'East',
    colorPrimary: '#000',
    colorSecondary: '#fff',
  }
}

describe('winPct', () => {
  it('counts a tie as half a win', () => {
    expect(winPct({ wins: 1, losses: 1, ties: 1 })).toBeCloseTo(0.5, 5)
  })

  it('returns 0 for a team with no games rather than NaN', () => {
    expect(winPct({ wins: 0, losses: 0, ties: 0 })).toBe(0)
  })
})

describe('commonOpponents', () => {
  it('requires at least 4 shared opponents to apply', () => {
    const teamsById = { A: team('A'), B: team('B'), C: team('C'), D: team('D'), E: team('E') }
    const games = [
      game('A', 'C', 10, 7),
      game('B', 'C', 10, 7),
      game('A', 'D', 10, 7),
      game('B', 'D', 10, 7),
      game('A', 'E', 10, 7),
      game('B', 'E', 10, 7),
    ]
    const logs = buildGameLogs(games, teamsById)
    // A and B share exactly 3 common opponents (C, D, E) -> below the min-4 threshold.
    expect(commonOpponents(['A', 'B'], logs)).toBeNull()
  })

  it('finds the shared opponents once there are at least 4', () => {
    const teamsById = {
      A: team('A'),
      B: team('B'),
      C: team('C'),
      D: team('D'),
      E: team('E'),
      F: team('F'),
    }
    const games = [
      game('A', 'C', 10, 7),
      game('B', 'C', 10, 7),
      game('A', 'D', 10, 7),
      game('B', 'D', 10, 7),
      game('A', 'E', 10, 7),
      game('B', 'E', 10, 7),
      game('A', 'F', 10, 7),
      game('B', 'F', 10, 7),
    ]
    const logs = buildGameLogs(games, teamsById)
    const common = commonOpponents(['A', 'B'], logs)
    expect(common && [...common].sort()).toEqual(['C', 'D', 'E', 'F'])
  })
})

describe('netPoints', () => {
  it('sums point differential across a team\'s games', () => {
    const teamsById = { A: team('A'), B: team('B'), C: team('C') }
    const games = [game('A', 'B', 20, 10), game('A', 'C', 14, 21)]
    const logs = buildGameLogs(games, teamsById)
    expect(netPoints(logs.A)).toBe(20 - 10 + 14 - 21)
  })
})

describe('combinedRank', () => {
  it('ranks by points scored and points allowed and sums the two ranks', () => {
    const teamsById = { A: team('A'), B: team('B'), C: team('C') }
    const games = [game('A', 'B', 40, 30), game('A', 'C', 20, 10), game('B', 'C', 10, 20)]
    const logs = buildGameLogs(games, teamsById)
    // Totals: A pf=60 pa=40, B pf=40 pa=60, C pf=30 pa=30.
    // Points-scored rank (most=1): A=1, B=2, C=3.
    // Points-allowed rank (fewest=1): C=1, A=2, B=3.
    const ranks = combinedRank(['A', 'B', 'C'], logs)
    expect(ranks.A).toBe(3) // 1 + 2
    expect(ranks.B).toBe(5) // 2 + 3
    expect(ranks.C).toBe(4) // 3 + 1
  })
})
