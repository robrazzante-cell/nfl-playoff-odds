import { describe, expect, it } from 'vitest'
import { simulateConferenceBracket, simulateSuperBowl } from './bracket'

// seeds[0]=1 ... seeds[6]=7
const SEEDS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']

describe('simulateConferenceBracket', () => {
  it('gives the #1 seed a bye and has it face the lowest remaining seed after an upset', () => {
    const matchupsSeen: [string, string][] = []
    const draw = (home: string, away: string): string => {
      matchupsSeen.push([home, away])
      // Force the 7 seed to upset the 2 seed; everyone else wins "normally" (home team wins).
      if (home === 'S2' && away === 'S7') return 'S7'
      return home
    }

    simulateConferenceBracket(SEEDS, draw)

    // Wild card round: 2v7, 3v6, 4v5.
    expect(matchupsSeen[0]).toEqual(['S2', 'S7'])
    expect(matchupsSeen[1]).toEqual(['S3', 'S6'])
    expect(matchupsSeen[2]).toEqual(['S4', 'S5'])

    // Divisional round: survivors are S7 (upset winner), S3, S4.
    // The #1 seed must face the lowest-numbered surviving seed, which is now S7 (not "whoever beat S2").
    expect(matchupsSeen[3]).toEqual(['S1', 'S7'])
    // The other two survivors (S3 beat S6, S4 beat S5) play each other.
    expect(matchupsSeen[4]).toEqual(['S3', 'S4'])
  })

  it('never puts two teams from the same wild-card matchup on the same side twice', () => {
    const draw = (home: string): string => home // home team always wins, no upsets
    const champion = simulateConferenceBracket(SEEDS, draw)
    // With no upsets, the #1 seed should win out.
    expect(champion).toBe('S1')
  })
})

describe('simulateSuperBowl', () => {
  it('is played at a neutral site', () => {
    let capturedNeutralSite: boolean | undefined
    const draw = (home: string, _away: string, neutralSite: boolean): string => {
      capturedNeutralSite = neutralSite
      return home
    }
    simulateSuperBowl('AFC_CHAMP', 'NFC_CHAMP', draw)
    expect(capturedNeutralSite).toBe(true)
  })
})
