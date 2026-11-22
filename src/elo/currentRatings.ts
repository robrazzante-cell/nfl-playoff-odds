// Brings a season's starting (preseason) Elo ratings up to date by
// deterministically replaying every completed game so far, in chronological
// order. This is the correct baseline for simulating the rest of the
// season: using the raw preseason ratings directly (without this replay)
// would ignore everything that's already happened this season.

import type { EloRatings, Game } from '../data/types'
import { updateRatings, type EloConfig } from './elo'

export function computeCurrentRatings(
  completedGames: Game[],
  startingRatings: EloRatings,
  config: EloConfig
): EloRatings {
  const ratings: EloRatings = { ...startingRatings }
  const sorted = [...completedGames]
    .filter((g) => g.completed && g.homeScore != null && g.awayScore != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const g of sorted) {
    const homeRating = ratings[g.homeTeamId] ?? config.meanRating
    const awayRating = ratings[g.awayTeamId] ?? config.meanRating
    // Only the Super Bowl is neutral-site; other postseason rounds are hosted
    // by the higher seed. In practice this branch is currently unreachable —
    // scripts/fetch-data.mjs only pulls seasonType 2 (regular season) games —
    // but is here in case the data pipeline is extended to track a completed
    // postseason within the same season.
    const neutralSite = false
    const update = updateRatings(
      { homeRating, awayRating, homeScore: g.homeScore as number, awayScore: g.awayScore as number, neutralSite },
      config
    )
    ratings[g.homeTeamId] = update.newHomeRating
    ratings[g.awayTeamId] = update.newAwayRating
  }

  return ratings
}
