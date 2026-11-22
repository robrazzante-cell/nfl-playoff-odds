// Shared type definitions used across the whole app: data pipeline output,
// Elo, tiebreakers, simulation, and UI all import from here.

export type Conference = 'AFC' | 'NFC'

export type Division = 'East' | 'North' | 'South' | 'West'

export interface Team {
  /** ESPN's numeric team id, used to match schedule data. */
  id: string
  abbr: string
  name: string
  location: string
  conference: Conference
  division: Division
  colorPrimary: string
  colorSecondary: string
}

/** One regular-season (or postseason) game, before or after it's played. */
export interface Game {
  id: string
  week: number
  seasonType: 2 | 3 // 2 = regular season, 3 = postseason
  date: string // ISO date string
  homeTeamId: string
  awayTeamId: string
  /** null until the game is played */
  homeScore: number | null
  awayScore: number | null
  completed: boolean
}

export interface SeasonMeta {
  season: number
  currentWeek: number
  lastUpdated: string // ISO timestamp
  source: string
}

/** A team's Elo rating at a point in time, keyed by team id. */
export type EloRatings = Record<string, number>

/** Which coin-toss / step-breaking outcome to use for a given simulation trial. */
export interface TiebreakRandomness {
  coinToss: (teamIds: string[]) => string
}

export interface TeamSeasonStats {
  teamId: string
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
  divisionWins: number
  divisionLosses: number
  divisionTies: number
  conferenceWins: number
  conferenceLosses: number
  conferenceTies: number
  netTouchdowns: number
}

export interface PlayoffSeed {
  seed: number // 1-7
  teamId: string
  conference: Conference
  isDivisionWinner: boolean
}

/** Outcome of one Monte Carlo trial, used for aggregation. */
export interface TrialResult {
  /** Final regular-season standing: seed 1-7 if they made the playoffs, else null. */
  seeds: Record<string, number | null>
  divisionWinners: Record<string, boolean>
  superBowlWinner: string | null
  conferenceChampion: Record<Conference, string | null>
}

/** A manual override for a single remaining game's result. */
export interface GameOverride {
  gameId: string
  /** teamId of the winner, or 'TIE' */
  result: string
}

export type SimMode = 'elo' | 'coinflip'

export interface SimRequest {
  games: Game[]
  overrides: GameOverride[]
  mode: SimMode
  trials: number
  ratings: EloRatings
}

export interface TeamAggregateOdds {
  teamId: string
  playoffPct: number
  divisionPct: number
  byePct: number
  seedPct: Record<number, number> // 1-7
  conferenceChampPct: number
  superBowlPct: number
}

export interface SimResponse {
  trialsRun: number
  teamOdds: Record<string, TeamAggregateOdds>
}

/** One entry in the "games that matter most" ranking for a spotlighted team. */
export interface SensitivityResult {
  gameId: string
  homeTeamId: string
  awayTeamId: string
  /** The spotlighted team's playoff odds if the home team wins this game. */
  playoffPctIfHomeWins: number
  /** The spotlighted team's playoff odds if the away team wins this game. */
  playoffPctIfAwayWins: number
}

export type WorkerRequest =
  | { type: 'simulate'; request: SimRequest }
  | {
      type: 'sensitivity'
      request: SimRequest
      teamId: string
      candidateGameIds: string[]
      trialsPerScenario: number
    }

export type WorkerResponse =
  | { type: 'progress'; completed: number; total: number }
  | { type: 'simulateDone'; response: SimResponse }
  | { type: 'sensitivityDone'; results: SensitivityResult[] }
