import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ELO_CONFIG,
  movMultiplier,
  revertTowardMean,
  updateRatings,
  winProbability,
} from './elo'

describe('winProbability', () => {
  it('gives equal teams a 50/50 shot at a neutral site', () => {
    expect(winProbability(1500, 1500, DEFAULT_ELO_CONFIG, true)).toBeCloseTo(0.5, 5)
  })

  it('favors the home team when ratings are equal (home field edge)', () => {
    const p = winProbability(1500, 1500, DEFAULT_ELO_CONFIG, false)
    expect(p).toBeGreaterThan(0.5)
  })

  it('home field bonus is skipped at a neutral site (Super Bowl)', () => {
    const neutral = winProbability(1500, 1500, DEFAULT_ELO_CONFIG, true)
    const home = winProbability(1500, 1500, DEFAULT_ELO_CONFIG, false)
    expect(neutral).toBeLessThan(home)
    expect(neutral).toBeCloseTo(0.5, 5)
  })

  it('gives a much higher-rated team a correspondingly higher win probability', () => {
    const p = winProbability(1700, 1300, DEFAULT_ELO_CONFIG, true)
    expect(p).toBeGreaterThan(0.85)
  })

  it('is monotonic: a higher rating never decreases win probability', () => {
    const base = winProbability(1500, 1400, DEFAULT_ELO_CONFIG, true)
    const higher = winProbability(1550, 1400, DEFAULT_ELO_CONFIG, true)
    expect(higher).toBeGreaterThan(base)
  })
})

describe('movMultiplier', () => {
  it('a bigger margin of victory produces a bigger multiplier, all else equal', () => {
    const small = movMultiplier(3, 0)
    const big = movMultiplier(28, 0)
    expect(big).toBeGreaterThan(small)
  })

  it('dampens the multiplier when the winner was already a big favorite', () => {
    const underdogWinBig = movMultiplier(28, -300) // winner was a 300-pt underdog
    const favoriteWinBig = movMultiplier(28, 300) // winner was a 300-pt favorite
    expect(underdogWinBig).toBeGreaterThan(favoriteWinBig)
  })
})

describe('updateRatings', () => {
  it('a decisive underdog upset moves ratings more than a no-surprise outcome', () => {
    // Favorite (1700 home) barely beats a big underdog (1300 away) by 1 point.
    const narrowFavoriteWin = updateRatings({
      homeRating: 1700,
      awayRating: 1300,
      homeScore: 21,
      awayScore: 20,
    })
    // Underdog (1300 home) blows out the favorite (1700 away) by 21.
    const bigUpset = updateRatings({
      homeRating: 1300,
      awayRating: 1700,
      homeScore: 31,
      awayScore: 10,
    })
    const favoriteNarrowShift = Math.abs(narrowFavoriteWin.newHomeRating - 1700)
    const upsetShift = Math.abs(bigUpset.newHomeRating - 1300)
    expect(upsetShift).toBeGreaterThan(favoriteNarrowShift)
  })

  it('a tie moves both ratings toward each other symmetrically for equal pre-game ratings', () => {
    const result = updateRatings({ homeRating: 1500, awayRating: 1500, homeScore: 20, awayScore: 20 })
    // Home still had the HFA edge, so a tie is a mild letdown for them, mild over-perform for away.
    expect(result.newHomeRating).toBeLessThan(1500)
    expect(result.newAwayRating).toBeGreaterThan(1500)
  })

  it('winning team gains rating, losing team loses rating', () => {
    const result = updateRatings({ homeRating: 1500, awayRating: 1500, homeScore: 24, awayScore: 10 })
    expect(result.newHomeRating).toBeGreaterThan(1500)
    expect(result.newAwayRating).toBeLessThan(1500)
  })

  it('rating changes are zero-sum (what one team gains, the other loses)', () => {
    const result = updateRatings({ homeRating: 1550, awayRating: 1480, homeScore: 27, awayScore: 24 })
    const homeGain = result.newHomeRating - 1550
    const awayLoss = result.newAwayRating - 1480
    expect(homeGain).toBeCloseTo(-awayLoss, 5)
  })
})

describe('revertTowardMean', () => {
  it('moves a rating above the mean partway back down', () => {
    const reverted = revertTowardMean(1700, DEFAULT_ELO_CONFIG)
    expect(reverted).toBeLessThan(1700)
    expect(reverted).toBeGreaterThan(DEFAULT_ELO_CONFIG.meanRating)
  })

  it('moves a rating below the mean partway back up', () => {
    const reverted = revertTowardMean(1300, DEFAULT_ELO_CONFIG)
    expect(reverted).toBeGreaterThan(1300)
    expect(reverted).toBeLessThan(DEFAULT_ELO_CONFIG.meanRating)
  })

  it('leaves a rating exactly at the mean unchanged', () => {
    const reverted = revertTowardMean(DEFAULT_ELO_CONFIG.meanRating, DEFAULT_ELO_CONFIG)
    expect(reverted).toBeCloseTo(DEFAULT_ELO_CONFIG.meanRating, 5)
  })
})
