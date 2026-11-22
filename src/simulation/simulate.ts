// Runs one full Monte Carlo trial: draws an outcome for every remaining
// regular-season game (weighted by Elo, overridden by a what-if pick, or a
// coin flip), updates ratings along the way, seeds both conferences, then
// simulates both playoff brackets and the Super Bowl.

import { updateRatings, winProbability, type EloConfig } from '../elo/elo'
import type { EloRatings, Game, SimMode, Team, TrialResult } from '../data/types'
import { buildGameLogs } from '../tiebreakers/stats'
import type { TiebreakContext } from '../tiebreakers/tiebreak'
import { seedConference } from '../playoffs/seeding'
import { simulateConferenceBracket, simulateSuperBowl, type BracketDraw } from '../playoffs/bracket'

// Real NFL ties are rare but do happen (roughly 1-2 per 272-game season).
const TIE_PROBABILITY = 0.006

type Outcome = 'home' | 'away' | 'tie'

/**
 * Turns a win/loss/tie draw into a nominal final score. The score itself is
 * synthetic (not calibrated to real NFL scoring distributions) — it only
 * exists to feed the point-based tiebreaker steps (net points, combined
 * ranking), which are reached rarely and rarely change a close seeding call.
 */
function syntheticScore(random: () => number, outcome: Outcome): { homeScore: number; awayScore: number } {
  if (outcome === 'tie') {
    const score = 17 + Math.round(random() * 10)
    return { homeScore: score, awayScore: score }
  }
  const margin = 3 + Math.round(random() * 20)
  const loserScore = 10 + Math.round(random() * 10)
  const winnerScore = loserScore + margin
  return outcome === 'home'
    ? { homeScore: winnerScore, awayScore: loserScore }
    : { homeScore: loserScore, awayScore: winnerScore }
}

function drawRegularSeasonOutcome(
  homeRating: number,
  awayRating: number,
  config: EloConfig,
  mode: SimMode,
  random: () => number
): Outcome {
  if (random() < TIE_PROBABILITY) return 'tie'
  const pHomeWin = mode === 'coinflip' ? 0.5 : winProbability(homeRating, awayRating, config, false)
  return random() < pHomeWin ? 'home' : 'away'
}

/** Playoff games are single-elimination — no ties possible. */
function drawPlayoffOutcome(
  homeRating: number,
  awayRating: number,
  config: EloConfig,
  mode: SimMode,
  neutralSite: boolean,
  random: () => number
): 'home' | 'away' {
  const pHomeWin = mode === 'coinflip' ? 0.5 : winProbability(homeRating, awayRating, config, neutralSite)
  return random() < pHomeWin ? 'home' : 'away'
}

export interface TrialInput {
  completedGames: Game[]
  remainingGames: Game[]
  teamsById: Record<string, Team>
  startingRatings: EloRatings
  /** gameId -> forced winner teamId, or the literal string 'TIE' */
  overrides: Map<string, string>
  mode: SimMode
  config: EloConfig
  random: () => number
  coinToss: (teamIds: string[]) => string
}

export function runTrial(input: TrialInput): TrialResult {
  const { teamsById, config, mode, random } = input
  const ratings: EloRatings = { ...input.startingRatings }
  const allRegularSeasonGames: Game[] = [...input.completedGames]

  for (const g of input.remainingGames) {
    const homeRating = ratings[g.homeTeamId] ?? config.meanRating
    const awayRating = ratings[g.awayTeamId] ?? config.meanRating

    const override = input.overrides.get(g.id)
    const outcome: Outcome =
      override === 'TIE'
        ? 'tie'
        : override === g.homeTeamId
          ? 'home'
          : override === g.awayTeamId
            ? 'away'
            : drawRegularSeasonOutcome(homeRating, awayRating, config, mode, random)

    const { homeScore, awayScore } = syntheticScore(random, outcome)
    allRegularSeasonGames.push({ ...g, homeScore, awayScore, completed: true })

    if (mode === 'elo') {
      const update = updateRatings({ homeRating, awayRating, homeScore, awayScore }, config)
      ratings[g.homeTeamId] = update.newHomeRating
      ratings[g.awayTeamId] = update.newAwayRating
    }
  }

  const logs = buildGameLogs(allRegularSeasonGames, teamsById)
  const ctx: TiebreakContext = { logs, teamsById, random: { coinToss: input.coinToss } }

  const afc = seedConference('AFC', teamsById, ctx)
  const nfc = seedConference('NFC', teamsById, ctx)

  const draw: BracketDraw = (homeTeamId, awayTeamId, neutralSite) => {
    const homeRating = ratings[homeTeamId] ?? config.meanRating
    const awayRating = ratings[awayTeamId] ?? config.meanRating
    const outcome = drawPlayoffOutcome(homeRating, awayRating, config, mode, neutralSite, random)
    const winnerId = outcome === 'home' ? homeTeamId : awayTeamId

    if (mode === 'elo') {
      const { homeScore, awayScore } = syntheticScore(random, outcome)
      const update = updateRatings({ homeRating, awayRating, homeScore, awayScore, neutralSite }, config)
      ratings[homeTeamId] = update.newHomeRating
      ratings[awayTeamId] = update.newAwayRating
    }
    return winnerId
  }

  const afcChampion = simulateConferenceBracket(afc.seeds, draw)
  const nfcChampion = simulateConferenceBracket(nfc.seeds, draw)
  const superBowlWinner = simulateSuperBowl(afcChampion, nfcChampion, draw)

  const seeds: Record<string, number | null> = {}
  for (const teamId of Object.keys(teamsById)) seeds[teamId] = null
  afc.seeds.forEach((teamId, i) => (seeds[teamId] = i + 1))
  nfc.seeds.forEach((teamId, i) => (seeds[teamId] = i + 1))

  const divisionWinners: Record<string, boolean> = {}
  for (const teamId of Object.keys(teamsById)) {
    divisionWinners[teamId] = afc.divisionWinners.has(teamId) || nfc.divisionWinners.has(teamId)
  }

  return {
    seeds,
    divisionWinners,
    superBowlWinner,
    conferenceChampion: { AFC: afcChampion, NFC: nfcChampion },
  }
}
