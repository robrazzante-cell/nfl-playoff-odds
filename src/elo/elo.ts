// FiveThirtyEight-style NFL Elo model.
//
// References the publicly documented 538 NFL Elo methodology:
// - Win probability from a logistic curve on the rating difference.
// - K-factor of ~20 per game.
// - A home-field advantage added to the home team's effective rating.
// - A margin-of-victory multiplier that dampens blowout credit for heavy
//   favorites and boosts it for upsets.
// - Partial reversion toward the league mean between seasons.

export const DEFAULT_K_FACTOR = 20
export const DEFAULT_HOME_FIELD_ADVANTAGE = 55 // Elo points added to the home team
export const DEFAULT_MEAN_RATING = 1505
/** Fraction of the gap to the mean that's carried over between seasons (538 uses ~1/3). */
export const DEFAULT_REVERSION_FACTOR = 1 / 3

export interface EloConfig {
  kFactor: number
  homeFieldAdvantage: number
  meanRating: number
  reversionFactor: number
}

export const DEFAULT_ELO_CONFIG: EloConfig = {
  kFactor: DEFAULT_K_FACTOR,
  homeFieldAdvantage: DEFAULT_HOME_FIELD_ADVANTAGE,
  meanRating: DEFAULT_MEAN_RATING,
  reversionFactor: DEFAULT_REVERSION_FACTOR,
}

/**
 * Probability that the home team wins, given both teams' current ratings.
 * Pass `neutralSite: true` (used for the Super Bowl) to skip the home-field bonus.
 */
export function winProbability(
  homeRating: number,
  awayRating: number,
  config: EloConfig = DEFAULT_ELO_CONFIG,
  neutralSite = false
): number {
  const hfa = neutralSite ? 0 : config.homeFieldAdvantage
  const eloDiff = homeRating + hfa - awayRating
  return 1 / (Math.pow(10, -eloDiff / 400) + 1)
}

/**
 * The 538 margin-of-victory multiplier. Larger blowouts move ratings more,
 * but the effect shrinks the more lopsided the pre-game rating gap already
 * was (so a 40-point win by a team already favored by 300 Elo doesn't move
 * the needle much — they were "supposed to" win big).
 */
export function movMultiplier(pointDiff: number, winnerEloDiffPreGame: number): number {
  const absDiff = Math.abs(pointDiff)
  if (absDiff === 0) return 1 // shouldn't happen for a decided game, but guard anyway
  return (Math.log(absDiff + 1) * 2.2) / (0.001 * winnerEloDiffPreGame + 2.2)
}

export interface GameResult {
  homeRating: number
  awayRating: number
  homeScore: number
  awayScore: number
  neutralSite?: boolean
}

export interface EloUpdateResult {
  newHomeRating: number
  newAwayRating: number
  homeWinProbability: number
}

/**
 * Updates both teams' ratings based on a completed (real or simulated) game.
 * Ties count as a half-win for both teams, matching 538's treatment.
 */
export function updateRatings(
  game: GameResult,
  config: EloConfig = DEFAULT_ELO_CONFIG
): EloUpdateResult {
  const { homeRating, awayRating, homeScore, awayScore, neutralSite = false } = game
  const hfa = neutralSite ? 0 : config.homeFieldAdvantage
  const eloDiffPreGame = homeRating + hfa - awayRating
  const homeWinProbability = winProbability(homeRating, awayRating, config, neutralSite)

  let homeActual: number
  if (homeScore > awayScore) homeActual = 1
  else if (homeScore < awayScore) homeActual = 0
  else homeActual = 0.5

  const pointDiff = homeScore - awayScore
  // MOV multiplier is defined in terms of the *winner's* pre-game Elo edge;
  // for ties, point diff is 0 so the multiplier term is moot (mult=1 via guard).
  const winnerEloDiff = homeActual >= 0.5 ? eloDiffPreGame : -eloDiffPreGame
  const mult = pointDiff === 0 ? 1 : movMultiplier(pointDiff, winnerEloDiff)

  const shift = config.kFactor * mult * (homeActual - homeWinProbability)

  return {
    newHomeRating: homeRating + shift,
    newAwayRating: awayRating - shift,
    homeWinProbability,
  }
}

/** Reverts a rating partway back toward the league mean, for the off-season. */
export function revertTowardMean(
  rating: number,
  config: EloConfig = DEFAULT_ELO_CONFIG
): number {
  return rating + config.reversionFactor * (config.meanRating - rating)
}
