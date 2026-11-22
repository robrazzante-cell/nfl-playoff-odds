// Computes every stat the official NFL tiebreaking procedures need, from a
// plain list of completed games. Works for a real season's games or a
// Monte Carlo trial's simulated games — same shape either way.

import type { Game, Team } from '../data/types'

export interface GameLogEntry {
  opponentId: string
  pf: number
  pa: number
  result: 'W' | 'L' | 'T'
  isDivision: boolean
  isConference: boolean
}

export type GameLogs = Record<string, GameLogEntry[]>

/** Builds each team's regular-season game log from a list of completed games. */
export function buildGameLogs(games: Game[], teamsById: Record<string, Team>): GameLogs {
  const logs: GameLogs = {}
  for (const teamId of Object.keys(teamsById)) logs[teamId] = []

  for (const g of games) {
    if (g.seasonType !== 2 || !g.completed || g.homeScore == null || g.awayScore == null) continue
    const home = teamsById[g.homeTeamId]
    const away = teamsById[g.awayTeamId]
    if (!home || !away) continue

    const isDivision = home.conference === away.conference && home.division === away.division
    const isConference = home.conference === away.conference

    const homeResult: GameLogEntry['result'] =
      g.homeScore > g.awayScore ? 'W' : g.homeScore < g.awayScore ? 'L' : 'T'
    const awayResult: GameLogEntry['result'] =
      homeResult === 'W' ? 'L' : homeResult === 'L' ? 'W' : 'T'

    logs[g.homeTeamId].push({
      opponentId: g.awayTeamId,
      pf: g.homeScore,
      pa: g.awayScore,
      result: homeResult,
      isDivision,
      isConference,
    })
    logs[g.awayTeamId].push({
      opponentId: g.homeTeamId,
      pf: g.awayScore,
      pa: g.homeScore,
      result: awayResult,
      isDivision,
      isConference,
    })
  }
  return logs
}

export interface Record_ {
  wins: number
  losses: number
  ties: number
}

function tally(entries: GameLogEntry[]): Record_ {
  const r: Record_ = { wins: 0, losses: 0, ties: 0 }
  for (const e of entries) {
    if (e.result === 'W') r.wins++
    else if (e.result === 'L') r.losses++
    else r.ties++
  }
  return r
}

/** Win percentage treating ties as half a win. Returns 0 for a team with no games. */
export function winPct(r: Record_): number {
  const total = r.wins + r.losses + r.ties
  if (total === 0) return 0
  return (r.wins + 0.5 * r.ties) / total
}

export function overallRecord(log: GameLogEntry[]): Record_ {
  return tally(log)
}

export function divisionRecord(log: GameLogEntry[]): Record_ {
  return tally(log.filter((e) => e.isDivision))
}

export function conferenceRecord(log: GameLogEntry[]): Record_ {
  return tally(log.filter((e) => e.isConference))
}

export function pointsForAgainst(log: GameLogEntry[]): { pf: number; pa: number } {
  let pf = 0
  let pa = 0
  for (const e of log) {
    pf += e.pf
    pa += e.pa
  }
  return { pf, pa }
}

export function netPoints(log: GameLogEntry[], opponentFilter?: Set<string>): number {
  const { pf, pa } = pointsForAgainst(
    opponentFilter ? log.filter((e) => opponentFilter.has(e.opponentId)) : log
  )
  return pf - pa
}

/**
 * Opponents common to every team in the group (played by all of them at
 * least once). The "common games" and "net points in common games" steps
 * only apply if this set has at least 4 opponents.
 */
export function commonOpponents(teamIds: string[], logs: GameLogs): Set<string> | null {
  if (teamIds.length === 0) return null
  let common: Set<string> | undefined
  for (const teamId of teamIds) {
    const opponents = new Set(logs[teamId].map((e) => e.opponentId))
    if (common === undefined) {
      common = opponents
    } else {
      const intersected = new Set<string>()
      for (const o of common) {
        if (opponents.has(o)) intersected.add(o)
      }
      common = intersected
    }
  }
  if (!common || common.size < 4) return null
  return common
}

export function recordVsOpponents(log: GameLogEntry[], opponentIds: Set<string>): Record_ {
  return tally(log.filter((e) => opponentIds.has(e.opponentId)))
}

/** Combined winning percentage of every team this team defeated (or tied). */
export function strengthOfVictory(log: GameLogEntry[], logs: GameLogs): number {
  const beatenOrTied = log.filter((e) => e.result !== 'L').map((e) => e.opponentId)
  if (beatenOrTied.length === 0) return 0
  const combined: Record_ = { wins: 0, losses: 0, ties: 0 }
  for (const opponentId of beatenOrTied) {
    const r = tally(logs[opponentId])
    combined.wins += r.wins
    combined.losses += r.losses
    combined.ties += r.ties
  }
  return winPct(combined)
}

/** Combined winning percentage of every team this team played. */
export function strengthOfSchedule(log: GameLogEntry[], logs: GameLogs): number {
  if (log.length === 0) return 0
  const combined: Record_ = { wins: 0, losses: 0, ties: 0 }
  for (const e of log) {
    const r = tally(logs[e.opponentId])
    combined.wins += r.wins
    combined.losses += r.losses
    combined.ties += r.ties
  }
  return winPct(combined)
}

/**
 * NFL's "combined ranking" step: rank every team in `universeTeamIds` by
 * total points scored (1 = most) and separately by total points allowed
 * (1 = fewest), then sum the two ranks per team. Lower combined rank is
 * better. Returns a map of teamId -> combined rank (only for teams present
 * in `universeTeamIds`).
 */
export function combinedRank(universeTeamIds: string[], logs: GameLogs): Record<string, number> {
  const totals = universeTeamIds.map((teamId) => ({ teamId, ...pointsForAgainst(logs[teamId]) }))
  const byPf = [...totals].sort((a, b) => b.pf - a.pf)
  const byPa = [...totals].sort((a, b) => a.pa - b.pa)

  const pfRank: Record<string, number> = {}
  byPf.forEach((t, i) => (pfRank[t.teamId] = i + 1))
  const paRank: Record<string, number> = {}
  byPa.forEach((t, i) => (paRank[t.teamId] = i + 1))

  const combined: Record<string, number> = {}
  for (const teamId of universeTeamIds) combined[teamId] = pfRank[teamId] + paRank[teamId]
  return combined
}
