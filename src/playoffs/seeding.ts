// Turns a completed (real or simulated) regular season into each
// conference's 7 playoff seeds, using the official NFL procedures:
// division winners seeded 1-4 by record (ties broken with the division-
// winner seeding procedure, which is the same step list as a cross-division
// wild-card tie, since by definition only one team per division reaches
// this step), wild cards seeded 5-7 among the rest.

import type { Conference, Team } from '../data/types'
import {
  breakDivisionTie,
  breakWildCardTie,
  overallWinPct,
  type TiebreakContext,
} from '../tiebreakers/tiebreak'

/**
 * Orders a group of teams by record, resolving any teams tied on record
 * with the given tiebreak procedure (division-title ties use
 * `breakDivisionTie`; everything else — wild cards and seeding among
 * division winners — uses `breakWildCardTie`).
 */
export function rankTeams(
  teamIds: string[],
  ctx: TiebreakContext,
  resolveTie: (group: string[], ctx: TiebreakContext) => string[]
): string[] {
  const groups = new Map<number, string[]>()
  for (const id of teamIds) {
    // Round to avoid spurious floating-point mismatches between teams that
    // played the same number of games and should compare exactly equal.
    const pct = Math.round(overallWinPct(id, ctx) * 1e6) / 1e6
    const group = groups.get(pct) ?? []
    group.push(id)
    groups.set(pct, group)
  }

  const sortedPcts = [...groups.keys()].sort((a, b) => b - a)
  const result: string[] = []
  for (const pct of sortedPcts) {
    const group = groups.get(pct)!
    result.push(...(group.length === 1 ? group : resolveTie(group, ctx)))
  }
  return result
}

export interface ConferenceSeeds {
  /** Index 0 = seed 1, ... index 6 = seed 7. */
  seeds: string[]
  divisionWinners: Set<string>
}

export function seedConference(
  conference: Conference,
  teamsById: Record<string, Team>,
  ctx: TiebreakContext
): ConferenceSeeds {
  const confTeams = Object.values(teamsById).filter((t) => t.conference === conference)
  const divisions = [...new Set(confTeams.map((t) => t.division))]

  const winners = divisions.map((division) => {
    const divisionTeamIds = confTeams.filter((t) => t.division === division).map((t) => t.id)
    return rankTeams(divisionTeamIds, ctx, breakDivisionTie)[0]
  })

  const seededWinners = rankTeams(winners, ctx, breakWildCardTie)

  const winnerSet = new Set(winners)
  const wildcardPool = confTeams.map((t) => t.id).filter((id) => !winnerSet.has(id))
  const seededWildcards = rankTeams(wildcardPool, ctx, breakWildCardTie).slice(0, 3)

  return {
    seeds: [...seededWinners, ...seededWildcards],
    divisionWinners: winnerSet,
  }
}
