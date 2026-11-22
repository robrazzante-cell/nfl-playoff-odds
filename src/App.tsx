import { useEffect, useMemo, useState } from 'react'
import { BROWNS_TEAM_ID, TEAMS, TEAMS_BY_ID } from './data/teams'
import type { GameOverride, SimMode, SimRequest } from './data/types'
import { DEFAULT_ELO_CONFIG } from './elo/elo'
import { computeCurrentRatings } from './elo/currentRatings'
import { useSeasonData } from './hooks/useSeasonData'
import { useSimulation } from './hooks/useSimulation'
import { readPicksFromUrl, writePicksToUrl } from './state/picks'
import { OddsTable } from './components/OddsTable'
import { WhatIfPicker } from './components/WhatIfPicker'
import { TeamSpotlight } from './components/TeamSpotlight'
import { GamesThatMatter } from './components/GamesThatMatter'
import { OddsOverTimeChart } from './components/OddsOverTimeChart'

const TRIALS = 10_000
const SENSITIVITY_TRIALS_PER_SCENARIO = 400

function App() {
  const { data, error } = useSeasonData()
  const { response, progress, running, runSimulation, sensitivityResults, sensitivityRunning, runSensitivity } =
    useSimulation()

  const [spotlightTeamId, setSpotlightTeamId] = useState(BROWNS_TEAM_ID)
  const [mode, setMode] = useState<SimMode>('elo')
  const [overrides, setOverrides] = useState<GameOverride[]>(() => readPicksFromUrl())

  useEffect(() => {
    writePicksToUrl(overrides)
  }, [overrides])

  const completedGames = useMemo(() => data?.games.filter((g) => g.completed) ?? [], [data])
  const remainingGames = useMemo(() => data?.games.filter((g) => !g.completed) ?? [], [data])

  const currentRatings = useMemo(
    () => (data ? computeCurrentRatings(completedGames, data.ratings, DEFAULT_ELO_CONFIG) : {}),
    [data, completedGames]
  )

  const overridesMap = useMemo(() => new Map(overrides.map((o) => [o.gameId, o.result])), [overrides])

  const simRequest = useMemo<SimRequest | null>(() => {
    if (!data) return null
    return { games: data.games, overrides, mode, trials: TRIALS, ratings: currentRatings }
  }, [data, overrides, mode, currentRatings])

  useEffect(() => {
    if (simRequest) runSimulation(simRequest)
  }, [simRequest, runSimulation])

  useEffect(() => {
    if (simRequest && remainingGames.length > 0) {
      runSensitivity(
        simRequest,
        spotlightTeamId,
        remainingGames.map((g) => g.id),
        SENSITIVITY_TRIALS_PER_SCENARIO
      )
    }
  }, [simRequest, spotlightTeamId, remainingGames, runSensitivity])

  function handleSetPick(gameId: string, result: string | null) {
    setOverrides((prev) => {
      const withoutThisGame = prev.filter((o) => o.gameId !== gameId)
      return result == null ? withoutThisGame : [...withoutThisGame, { gameId, result }]
    })
  }

  function handleResetWeek(week: number) {
    const gameIdsInWeek = new Set(remainingGames.filter((g) => g.week === week).map((g) => g.id))
    setOverrides((prev) => prev.filter((o) => !gameIdsInWeek.has(o.gameId)))
  }

  function handleResetAll() {
    setOverrides([])
  }

  if (error) {
    return (
      <div className="page-state">
        <p>Couldn't load season data: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-state">
        <p>Loading season data…</p>
      </div>
    )
  }

  const spotlightTeam = TEAMS_BY_ID[spotlightTeamId]

  return (
    <div className="app">
      <header className="app-header">
        <h1>NFL Playoff Odds Simulator</h1>
        <p className="muted">
          {TRIALS.toLocaleString()} season simulations through week {data.meta.currentWeek}, updated{' '}
          {new Date(data.meta.lastUpdated).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          . Data source: {data.meta.source}.
        </p>
        <div className="mode-toggle">
          <label>
            <input type="radio" name="mode" checked={mode === 'elo'} onChange={() => setMode('elo')} />
            Elo-weighted odds
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === 'coinflip'} onChange={() => setMode('coinflip')} />
            Coin flip (every game 50/50)
          </label>
        </div>
        {running && (
          <p className="muted">
            Simulating… {progress ? `${Math.round((progress.completed / progress.total) * 100)}%` : ''}
          </p>
        )}
      </header>

      <TeamSpotlight
        team={spotlightTeam}
        teams={TEAMS}
        onChangeTeam={setSpotlightTeamId}
        odds={response?.teamOdds[spotlightTeamId] ?? null}
        trialsRun={response?.trialsRun ?? TRIALS}
        remainingGames={remainingGames}
        teamsById={TEAMS_BY_ID}
        sensitivityResults={sensitivityResults}
        overrides={overridesMap}
        onSetPick={handleSetPick}
      />

      <GamesThatMatter
        team={spotlightTeam}
        teamsById={TEAMS_BY_ID}
        sensitivityResults={sensitivityResults}
        loading={sensitivityRunning}
      />

      <section className="chart-section">
        <h3>{spotlightTeam.name} playoff odds over time</h3>
        <OddsOverTimeChart team={spotlightTeam} teams={TEAMS} />
      </section>

      <section className="what-if-section">
        <h2>What if...?</h2>
        <WhatIfPicker
          remainingGames={remainingGames}
          teamsById={TEAMS_BY_ID}
          overrides={overridesMap}
          onSetPick={handleSetPick}
          onResetWeek={handleResetWeek}
          onResetAll={handleResetAll}
        />
      </section>

      <section className="odds-table-section">
        <h2>All 32 teams</h2>
        <OddsTable teams={TEAMS} response={response} onSelectTeam={setSpotlightTeamId} />
      </section>

      <footer className="app-footer">
        <p className="muted">
          Playoff odds use a FiveThirtyEight-style Elo model with official NFL tiebreaking procedures, run as a
          Monte Carlo simulation in your browser. Not an official NFL product.
        </p>
      </footer>
    </div>
  )
}

export default App
