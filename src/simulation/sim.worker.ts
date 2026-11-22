// Runs the Monte Carlo trials off the main thread so the page stays
// responsive. Vite picks this up automatically via `new Worker(new
// URL('./sim.worker.ts', import.meta.url), { type: 'module' })` — no extra
// plugin needed.

import { DEFAULT_ELO_CONFIG } from '../elo/elo'
import { TEAMS_BY_ID } from '../data/teams'
import type { GameOverride, SensitivityResult, SimRequest, TrialResult, WorkerRequest, WorkerResponse } from '../data/types'
import { runTrial } from './simulate'
import { aggregateTrials } from './aggregate'

// A small, fast PRNG (mulberry32) seeded per trial — plenty good for Monte
// Carlo sampling and avoids depending on Math.random's internals.
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function runTrials(
  request: SimRequest,
  overridesOverride?: Map<string, string>,
  onProgress?: (completed: number, total: number) => void
) {
  const completedGames = request.games.filter((g) => g.completed)
  const remainingGames = request.games.filter((g) => !g.completed)
  const overrides = overridesOverride ?? new Map(request.overrides.map((o) => [o.gameId, o.result]))
  const progressEvery = Math.max(1, Math.floor(request.trials / 20))

  const trials: TrialResult[] = []
  for (let i = 0; i < request.trials; i++) {
    const random = mulberry32((i + 1) * 2654435761)
    const coinToss = (teamIds: string[]) => teamIds[Math.floor(random() * teamIds.length)]
    trials.push(
      runTrial({
        completedGames,
        remainingGames,
        teamsById: TEAMS_BY_ID,
        startingRatings: request.ratings,
        overrides,
        mode: request.mode,
        config: DEFAULT_ELO_CONFIG,
        random,
        coinToss,
      })
    )
    if (onProgress && i % progressEvery === 0) onProgress(i, request.trials)
  }
  return trials
}

function mergedOverrides(base: GameOverride[], extra: GameOverride): Map<string, string> {
  const map = new Map(base.filter((o) => o.gameId !== extra.gameId).map((o) => [o.gameId, o.result]))
  map.set(extra.gameId, extra.result)
  return map
}

function handleSimulate(request: SimRequest) {
  const trials = runTrials(request, undefined, (completed, total) => post({ type: 'progress', completed, total }))
  const teamIds = Object.keys(TEAMS_BY_ID)
  const response = aggregateTrials(trials, teamIds)
  post({ type: 'simulateDone', response })
}

function handleSensitivity(
  baseRequest: SimRequest,
  teamId: string,
  candidateGameIds: string[],
  trialsPerScenario: number
) {
  const results: SensitivityResult[] = []
  const gamesById = new Map(baseRequest.games.map((g) => [g.id, g]))

  candidateGameIds.forEach((gameId, index) => {
    post({ type: 'progress', completed: index, total: candidateGameIds.length })
    const g = gamesById.get(gameId)
    if (!g) return

    const homeRequest: SimRequest = { ...baseRequest, trials: trialsPerScenario }
    const homeTrials = runTrials(homeRequest, mergedOverrides(baseRequest.overrides, { gameId, result: g.homeTeamId }))
    const homeOdds = aggregateTrials(homeTrials, [teamId]).teamOdds[teamId].playoffPct

    const awayRequest: SimRequest = { ...baseRequest, trials: trialsPerScenario }
    const awayTrials = runTrials(awayRequest, mergedOverrides(baseRequest.overrides, { gameId, result: g.awayTeamId }))
    const awayOdds = aggregateTrials(awayTrials, [teamId]).teamOdds[teamId].playoffPct

    results.push({
      gameId,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      playoffPctIfHomeWins: homeOdds,
      playoffPctIfAwayWins: awayOdds,
    })
  })

  post({ type: 'sensitivityDone', results })
}

const workerSelf = self as unknown as Worker

function post(message: WorkerResponse) {
  workerSelf.postMessage(message)
}

workerSelf.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data
  if (msg.type === 'simulate') {
    handleSimulate(msg.request)
  } else if (msg.type === 'sensitivity') {
    handleSensitivity(msg.request, msg.teamId, msg.candidateGameIds, msg.trialsPerScenario)
  }
}
