// Simulates a single conference's 7-team playoff bracket (current format:
// #1 seed gets a bye, seeds 2-7 play in the wild-card round), then the
// Super Bowl. Re-seeding after the wild-card round follows the real NFL
// rule: the #1 seed always plays the lowest remaining seed, and that
// "remaining seed" travels with whichever team won — e.g. if the 7 seed
// upsets the 2 seed, the 1 seed's divisional-round opponent is "the 7 seed"
// (now the only team left with that number), not "whoever beat the 2 seed".

export interface BracketDraw {
  (homeTeamId: string, awayTeamId: string, neutralSite: boolean): string
}

interface Seeded {
  teamId: string
  seed: number
}

function resolveWinner(winnerId: string, a: Seeded, b: Seeded): Seeded {
  return winnerId === a.teamId ? a : b
}

/** `seeds[0]` is seed 1 ... `seeds[6]` is seed 7. Returns the conference champion's team id. */
export function simulateConferenceBracket(seeds: string[], draw: BracketDraw): string {
  const bySeed: Seeded = { teamId: seeds[0], seed: 1 }
  const wildCardMatchups: [Seeded, Seeded][] = [
    [{ teamId: seeds[1], seed: 2 }, { teamId: seeds[6], seed: 7 }],
    [{ teamId: seeds[2], seed: 3 }, { teamId: seeds[5], seed: 6 }],
    [{ teamId: seeds[3], seed: 4 }, { teamId: seeds[4], seed: 5 }],
  ]

  const wildCardWinners = wildCardMatchups.map(([home, away]) =>
    resolveWinner(draw(home.teamId, away.teamId, false), home, away)
  )

  const [best, mid, worst] = [...wildCardWinners].sort((a, b) => a.seed - b.seed)

  const divWinner1 = resolveWinner(draw(bySeed.teamId, worst.teamId, false), bySeed, worst)
  const divWinner2 = resolveWinner(draw(best.teamId, mid.teamId, false), best, mid)

  const [champHome, champAway] =
    divWinner1.seed < divWinner2.seed ? [divWinner1, divWinner2] : [divWinner2, divWinner1]

  return draw(champHome.teamId, champAway.teamId, false)
}

/** Neutral site — no home-field edge for either team. */
export function simulateSuperBowl(afcChampion: string, nfcChampion: string, draw: BracketDraw): string {
  return draw(afcChampion, nfcChampion, true)
}
