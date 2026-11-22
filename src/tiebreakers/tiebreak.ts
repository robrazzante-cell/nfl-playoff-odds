// Official NFL tiebreaking procedures (current format, verified against the
// league's published rules), implemented as an ordered list of "steps".
//
// How this works for 3+ tied teams: we repeatedly extract the single best
// remaining team by running the step list against the current group, then
// re-run the whole thing on whoever's left to find the next-best, and so on.
// That's exactly how the NFL's own "restart at step one" rule behaves in
// practice: once a step narrows a group (but doesn't reduce it to one team),
// the narrowed-down subgroup restarts at step one among themselves; once a
// step picks exactly one team, that team is settled and everyone else goes
// back to the full procedure for the next spot.
//
// Known, deliberate approximations (flagged per the project brief):
// - "Net touchdowns" (the step right before the final coin toss) can't be
//   computed from this app's data, which only has final scores, not scoring
//   play detail. This step always reports "not applicable" and falls through
//   to the coin toss. In the real NFL this step is reached only when every
//   single other step — up to and including net points across the whole
//   season — ties exactly, which is vanishingly rare, so in practice this
//   almost never changes the outcome.
// - Head-to-head among 3+ tied teams: the official rule lets head-to-head
//   decide if one team swept or was swept by the others. We only use the
//   "swept all others" case to pick a winner outright (since we're always
//   looking for "who's best," not "who's worst" — "lost to everyone" tells
//   you who's worst, which the extract-the-best loop doesn't need; it falls
//   out naturally in a later pass once the sweeper is removed).
// - When a wildcard tie includes 2+ teams from the same division, we reduce
//   that cluster to its single best representative (via the division
//   tiebreaker) before running the wildcard steps, per the official rule.
//   A division's eliminated runner-up is slotted immediately after its own
//   representative in the final order rather than getting a full separate
//   pass against the other divisions' teams. This only matters in the rare
//   case where 3+ teams from one division are simultaneously tied with
//   teams from other divisions for wildcard position — a scenario official
//   sources don't fully spell out either.

import type { Team, TiebreakRandomness } from '../data/types'
import {
  combinedRank,
  commonOpponents,
  conferenceRecord,
  divisionRecord,
  netPoints,
  overallRecord,
  recordVsOpponents,
  strengthOfSchedule,
  strengthOfVictory,
  winPct,
  type GameLogs,
} from './stats'

export interface TiebreakContext {
  logs: GameLogs
  teamsById: Record<string, Team>
  random: TiebreakRandomness
}

/** A step returns a higher-is-better score per team, or null if it doesn't apply to this group. */
type StepFn = (teamIds: string[], ctx: TiebreakContext) => Record<string, number> | null

function headToHeadStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> | null {
  if (teamIds.length === 2) {
    const [a, b] = teamIds
    const meetings = ctx.logs[a].filter((e) => e.opponentId === b)
    if (meetings.length === 0) return null
    const r = { wins: 0, losses: 0, ties: 0 }
    for (const e of meetings) {
      if (e.result === 'W') r.wins++
      else if (e.result === 'L') r.losses++
      else r.ties++
    }
    const aPct = winPct(r)
    return { [a]: aPct, [b]: 1 - aPct }
  }

  // 3+ teams: only applicable if exactly one team swept every other team in
  // the group (beat them in every meeting, and met all of them at least once).
  for (const candidate of teamIds) {
    const others = teamIds.filter((t) => t !== candidate)
    const sweptAll = others.every((opponentId) => {
      const meetings = ctx.logs[candidate].filter((e) => e.opponentId === opponentId)
      return meetings.length > 0 && meetings.every((e) => e.result === 'W')
    })
    if (sweptAll) {
      const scores: Record<string, number> = {}
      for (const t of teamIds) scores[t] = t === candidate ? 1 : 0
      return scores
    }
  }
  return null
}

function divisionRecordStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const t of teamIds) scores[t] = winPct(divisionRecord(ctx.logs[t]))
  return scores
}

function conferenceRecordStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const t of teamIds) scores[t] = winPct(conferenceRecord(ctx.logs[t]))
  return scores
}

function commonGamesStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> | null {
  const common = commonOpponents(teamIds, ctx.logs)
  if (!common) return null
  const scores: Record<string, number> = {}
  for (const t of teamIds) scores[t] = winPct(recordVsOpponents(ctx.logs[t], common))
  return scores
}

function strengthOfVictoryStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const t of teamIds) scores[t] = strengthOfVictory(ctx.logs[t], ctx.logs)
  return scores
}

function strengthOfScheduleStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const t of teamIds) scores[t] = strengthOfSchedule(ctx.logs[t], ctx.logs)
  return scores
}

function combinedRankConferenceStep(
  teamIds: string[],
  ctx: TiebreakContext
): Record<string, number> {
  const conference = ctx.teamsById[teamIds[0]].conference
  const universe = Object.values(ctx.teamsById)
    .filter((t) => t.conference === conference)
    .map((t) => t.id)
  const ranks = combinedRank(universe, ctx.logs)
  const scores: Record<string, number> = {}
  for (const t of teamIds) scores[t] = -ranks[t] // lower rank sum is better -> negate
  return scores
}

function combinedRankAllStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> {
  const universe = Object.keys(ctx.teamsById)
  const ranks = combinedRank(universe, ctx.logs)
  const scores: Record<string, number> = {}
  for (const t of teamIds) scores[t] = -ranks[t]
  return scores
}

function netPointsCommonStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> | null {
  const common = commonOpponents(teamIds, ctx.logs)
  if (!common) return null
  const scores: Record<string, number> = {}
  for (const t of teamIds) scores[t] = netPoints(ctx.logs[t], common)
  return scores
}

function netPointsConferenceStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const t of teamIds) {
    const conferenceOpponents = new Set(
      ctx.logs[t].filter((e) => e.isConference).map((e) => e.opponentId)
    )
    scores[t] = netPoints(ctx.logs[t], conferenceOpponents)
  }
  return scores
}

function netPointsAllStep(teamIds: string[], ctx: TiebreakContext): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const t of teamIds) scores[t] = netPoints(ctx.logs[t])
  return scores
}

/** Always inapplicable — see the "known approximations" note at the top of this file. */
function netTouchdownsStep(): null {
  return null
}

/** Two-club and multi-club division tie: 11 steps, then a coin toss. */
export const DIVISION_STEPS: StepFn[] = [
  headToHeadStep,
  divisionRecordStep,
  commonGamesStep,
  conferenceRecordStep,
  strengthOfVictoryStep,
  strengthOfScheduleStep,
  combinedRankConferenceStep,
  combinedRankAllStep,
  netPointsCommonStep,
  netPointsAllStep,
  netTouchdownsStep,
]

/** Two-club and multi-club wild-card tie (teams from different divisions): 10 steps, then a coin toss. */
export const WILDCARD_STEPS: StepFn[] = [
  headToHeadStep,
  conferenceRecordStep,
  commonGamesStep,
  strengthOfVictoryStep,
  strengthOfScheduleStep,
  combinedRankConferenceStep,
  combinedRankAllStep,
  netPointsConferenceStep,
  netPointsAllStep,
  netTouchdownsStep,
]

function findTop(teamIds: string[], steps: StepFn[], ctx: TiebreakContext): string {
  if (teamIds.length === 1) return teamIds[0]

  for (const step of steps) {
    const scores = step(teamIds, ctx)
    if (scores == null) continue

    const maxScore = Math.max(...teamIds.map((t) => scores[t]))
    const survivors = teamIds.filter((t) => scores[t] === maxScore)

    if (survivors.length === 1) return survivors[0]
    if (survivors.length < teamIds.length) return findTop(survivors, steps, ctx)
    // Everyone still tied on this step -> fall through to the next step.
  }

  return ctx.random.coinToss(teamIds)
}

/**
 * Fully orders a group of teams tied on record, best first, using the given
 * step list (DIVISION_STEPS or WILDCARD_STEPS). Repeatedly extracts the best
 * remaining team, per the NFL's restart-after-elimination rule.
 */
export function breakTie(teamIds: string[], steps: StepFn[], ctx: TiebreakContext): string[] {
  const order: string[] = []
  let remaining = [...teamIds]
  while (remaining.length > 1) {
    const top = findTop(remaining, steps, ctx)
    order.push(top)
    remaining = remaining.filter((t) => t !== top)
  }
  if (remaining.length === 1) order.push(remaining[0])
  return order
}

export function breakDivisionTie(teamIds: string[], ctx: TiebreakContext): string[] {
  return breakTie(teamIds, DIVISION_STEPS, ctx)
}

/**
 * Orders a group of teams tied for wild-card position. If 2+ teams share a
 * division, that cluster is first reduced to its single best representative
 * via the division tiebreaker (official rule); the division's runner-up(s)
 * are slotted back in immediately after their representative.
 */
export function breakWildCardTie(teamIds: string[], ctx: TiebreakContext): string[] {
  const byDivision = new Map<string, string[]>()
  for (const teamId of teamIds) {
    const team = ctx.teamsById[teamId]
    const key = `${team.conference}-${team.division}`
    const group = byDivision.get(key) ?? []
    group.push(teamId)
    byDivision.set(key, group)
  }

  const representatives: string[] = []
  const runnersUpByRepresentative = new Map<string, string[]>()

  for (const group of byDivision.values()) {
    if (group.length === 1) {
      representatives.push(group[0])
      continue
    }
    const ordered = breakDivisionTie(group, ctx)
    representatives.push(ordered[0])
    runnersUpByRepresentative.set(ordered[0], ordered.slice(1))
  }

  const repOrder = breakTie(representatives, WILDCARD_STEPS, ctx)

  const finalOrder: string[] = []
  for (const rep of repOrder) {
    finalOrder.push(rep)
    const runnersUp = runnersUpByRepresentative.get(rep)
    if (runnersUp) finalOrder.push(...runnersUp)
  }
  return finalOrder
}

/** Picks one highest-ranked team per division from a pool (used to seed wild-card races). */
export function reduceToDivisionLeader(
  teamIds: string[],
  ctx: TiebreakContext
): Record<string, string> {
  const byDivision = new Map<string, string[]>()
  for (const teamId of teamIds) {
    const team = ctx.teamsById[teamId]
    const key = `${team.conference}-${team.division}`
    const group = byDivision.get(key) ?? []
    group.push(teamId)
    byDivision.set(key, group)
  }
  const leaders: Record<string, string> = {}
  for (const [key, group] of byDivision) {
    leaders[key] = group.length === 1 ? group[0] : breakDivisionTie(group, ctx)[0]
  }
  return leaders
}

export function overallWinPct(teamId: string, ctx: TiebreakContext): number {
  return winPct(overallRecord(ctx.logs[teamId]))
}
