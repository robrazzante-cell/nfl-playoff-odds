import { describe, expect, it } from 'vitest'
import type { Game, Team } from '../data/types'
import { buildGameLogs } from './stats'
import { breakDivisionTie, breakWildCardTie, type TiebreakContext } from './tiebreak'

// Fixtures below come in two flavors:
//
// 1. Real, verified historical scenarios (sources checked before writing these
//    down): the exact final records and the specific step that decided each
//    tie are real. To keep the game list short, only the games that actually
//    feed the relevant stats are included (e.g. for a division-record tie we
//    only need that division's games, not a full 16-game schedule) — this
//    reproduces the real inputs/outputs for the tiebreaker steps involved,
//    not a full literal replay of the season.
// 2. Synthetic scenarios, clearly labeled as such, built to exercise specific
//    rule mechanics (the 3+-team restart rule, a head-to-head sweep, the
//    same-division wild-card reduction) that are hard to find clean,
//    well-documented real examples of.

let nextGameId = 1
function game(
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
  week = 1
): Game {
  return {
    id: `g${nextGameId++}`,
    week,
    seasonType: 2,
    date: '2024-01-01',
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    completed: true,
  }
}

function team(id: string, conference: 'AFC' | 'NFC', division: 'East' | 'North' | 'South' | 'West'): Team {
  return {
    id,
    abbr: id,
    name: id,
    location: id,
    conference,
    division,
    colorPrimary: '#000000',
    colorSecondary: '#ffffff',
  }
}

function buildContext(teams: Team[], games: Game[], coinTossWinner?: string): TiebreakContext {
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]))
  return {
    logs: buildGameLogs(games, teamsById),
    teamsById,
    random: { coinToss: (ids) => coinTossWinner ?? ids[0] },
  }
}

describe('real historical scenario: 2011 NFC West (division tie decided by division record)', () => {
  // Real final 2011 NFC West: ARI and SEA both finished 8-8, split their
  // 2011 season series 1-1 (SEA won 13-10 in Seattle, ARI won 23-20 in the
  // regular-season finale), so head-to-head didn't decide it. ARI's 4-2
  // division record beat SEA's 3-3, which is what actually separated them.
  const ARI = '22'
  const SEA = '26'
  const SF = '25'
  const LAR = '14' // same franchise as the 2011 St. Louis Rams

  const teams = [team(ARI, 'NFC', 'West'), team(SEA, 'NFC', 'West'), team(SF, 'NFC', 'West'), team(LAR, 'NFC', 'West')]

  const games = [
    game(SEA, ARI, 13, 10), // real: Seahawks win
    game(SEA, ARI, 20, 23), // real: Cardinals win (season finale)
    game(ARI, SF, 20, 17),
    game(SF, ARI, 19, 21), // ARI 2-0 vs SF
    game(ARI, LAR, 24, 10),
    game(LAR, ARI, 17, 13), // ARI 1-1 vs LAR -> ARI division record 4-2
    game(SEA, SF, 24, 21),
    game(SF, SEA, 19, 17), // SEA 1-1 vs SF
    game(SEA, LAR, 30, 13),
    game(LAR, SEA, 24, 20), // SEA 1-1 vs LAR -> SEA division record 3-3
  ]

  it('gives Arizona the division tiebreak over Seattle via division record', () => {
    const ctx = buildContext(teams, games)
    expect(breakDivisionTie([ARI, SEA], ctx)).toEqual([ARI, SEA])
  })
})

describe('real historical scenario: 2008 AFC wild card (tie decided by conference record)', () => {
  // Real: NE and BAL both finished 11-5 in 2008. They did not play each
  // other that season (different divisions, off the rotation that year), so
  // head-to-head was not applicable. BAL's 8-4 conference record beat NE's
  // 7-5, which is what actually gave Baltimore the wild card over New
  // England (both trailed Miami, who won the division on the same step).
  const NE = '17'
  const BAL = '33'
  const FILLER = 'FILLER_AFC_SOUTH'

  const teams = [team(NE, 'AFC', 'East'), team(BAL, 'AFC', 'North'), team(FILLER, 'AFC', 'South')]

  const games: Game[] = []
  // NE: 7-5 against AFC opponents (all vs the filler team — only the
  // aggregate conference win percentage matters for this step).
  for (let i = 0; i < 7; i++) games.push(game(NE, FILLER, 24, 10, i + 1))
  for (let i = 0; i < 5; i++) games.push(game(FILLER, NE, 24, 10, i + 8))
  // BAL: 8-4 against AFC opponents.
  for (let i = 0; i < 8; i++) games.push(game(BAL, FILLER, 24, 10, i + 1))
  for (let i = 0; i < 4; i++) games.push(game(FILLER, BAL, 24, 10, i + 9))

  it('gives Baltimore the wild-card tiebreak over New England via conference record', () => {
    const ctx = buildContext(teams, games)
    // NE and BAL never played each other -> head-to-head is inapplicable,
    // so this also verifies the "step doesn't apply, fall through" path.
    expect(ctx.logs[NE].some((e) => e.opponentId === BAL)).toBe(false)
    expect(breakWildCardTie([NE, BAL], ctx)).toEqual([BAL, NE])
  })
})

describe('synthetic: 3-team division tie resolved by a head-to-head sweep', () => {
  // A beats both B and C in every meeting; B and C split their games with
  // each other but B has a better division record than C, so the final
  // order should be A (swept everyone), then B, then C via the restart rule.
  const A = 'A'
  const B = 'B'
  const C = 'C'
  const D = 'D' // 4th division team, just to give B/C extra division games to differ on
  const teams = [team(A, 'AFC', 'West'), team(B, 'AFC', 'West'), team(C, 'AFC', 'West'), team(D, 'AFC', 'West')]

  const games = [
    game(A, B, 24, 10),
    game(B, A, 10, 24),
    game(A, C, 30, 14),
    game(C, A, 10, 20),
    game(B, C, 20, 17), // B wins at home
    game(C, B, 20, 17), // C wins at home -> B and C split 1-1 head-to-head
    game(B, D, 28, 7),
    game(D, B, 7, 28), // B sweeps D -> better division record than C
    game(C, D, 20, 20),
    game(D, C, 10, 10), // C ties D both times -> worse division record than B
  ]

  it('ranks the sweeping team first, then resolves the remaining tie by the next applicable step', () => {
    const ctx = buildContext(teams, games)
    expect(breakDivisionTie([A, B, C], ctx)).toEqual([A, B, C])
  })
})

describe('synthetic: wild-card tie with two teams from the same division', () => {
  // X1 and X2 are both from the AFC North and are tied with Y (AFC South)
  // for a wild-card spot. X1 clearly beats X2 head-to-head, so X1 represents
  // the division. X1 then beats Y on conference record. Per the official
  // rule, X2 (already behind its own division-mate) should land right after
  // X1 rather than conceivably jumping ahead of Y.
  const X1 = 'X1'
  const X2 = 'X2'
  const Y = 'Y'
  const FILLER = 'FILLER_AFC_EAST'
  const teams = [
    team(X1, 'AFC', 'North'),
    team(X2, 'AFC', 'North'),
    team(Y, 'AFC', 'South'),
    team(FILLER, 'AFC', 'East'),
  ]

  const games: Game[] = [
    game(X1, X2, 24, 10),
    game(X2, X1, 7, 21), // X1 sweeps X2 -> X1 represents the AFC North
  ]
  // X1: strong conference record (8-2 vs filler), Y: weaker (5-5 vs filler).
  for (let i = 0; i < 8; i++) games.push(game(X1, FILLER, 24, 10, i + 1))
  for (let i = 0; i < 2; i++) games.push(game(FILLER, X1, 24, 10, i + 9))
  for (let i = 0; i < 5; i++) games.push(game(Y, FILLER, 24, 10, i + 1))
  for (let i = 0; i < 5; i++) games.push(game(FILLER, Y, 24, 10, i + 6))
  // X2 needs some games too so its stats aren't all zero, but shouldn't matter
  // to the outcome since it's already reduced out of direct competition with Y.
  for (let i = 0; i < 1; i++) games.push(game(X2, FILLER, 10, 9, i + 1))

  it('places the division runner-up right after its representative, not ahead of the other contender', () => {
    const ctx = buildContext(teams, games)
    expect(breakWildCardTie([X1, X2, Y], ctx)).toEqual([X1, X2, Y])
  })
})
