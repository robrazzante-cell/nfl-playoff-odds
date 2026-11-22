import { describe, expect, it } from 'vitest'
import type { Game } from '../data/types'
import { DEFAULT_ELO_CONFIG, updateRatings } from './elo'
import { computeCurrentRatings } from './currentRatings'

function game(id: string, date: string, home: string, away: string, homeScore: number, awayScore: number): Game {
  return { id, week: 1, seasonType: 2, date, homeTeamId: home, awayTeamId: away, homeScore, awayScore, completed: true }
}

describe('computeCurrentRatings', () => {
  it('matches a manual sequential replay of completed games', () => {
    const starting = { A: 1500, B: 1500 }
    const games = [
      game('g1', '2024-09-08', 'A', 'B', 24, 10),
      game('g2', '2024-09-15', 'B', 'A', 17, 20),
    ]

    const result = computeCurrentRatings(games, starting, DEFAULT_ELO_CONFIG)

    // Manual replay for comparison.
    const u1 = updateRatings({ homeRating: 1500, awayRating: 1500, homeScore: 24, awayScore: 10 }, DEFAULT_ELO_CONFIG)
    const u2 = updateRatings(
      { homeRating: u1.newAwayRating, awayRating: u1.newHomeRating, homeScore: 17, awayScore: 20 },
      DEFAULT_ELO_CONFIG
    )
    expect(result.A).toBeCloseTo(u2.newAwayRating, 5)
    expect(result.B).toBeCloseTo(u2.newHomeRating, 5)
  })

  it('processes games in chronological order regardless of input order', () => {
    const starting = { A: 1500, B: 1500 }
    const inOrder = [game('g1', '2024-09-08', 'A', 'B', 24, 10), game('g2', '2024-09-15', 'A', 'B', 10, 24)]
    const reversed = [inOrder[1], inOrder[0]]

    expect(computeCurrentRatings(inOrder, starting, DEFAULT_ELO_CONFIG)).toEqual(
      computeCurrentRatings(reversed, starting, DEFAULT_ELO_CONFIG)
    )
  })

  it('leaves ratings untouched when there are no completed games', () => {
    const starting = { A: 1500, B: 1480 }
    expect(computeCurrentRatings([], starting, DEFAULT_ELO_CONFIG)).toEqual(starting)
  })
})
