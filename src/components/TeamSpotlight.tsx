import { useMemo } from 'react'
import type { Game, SensitivityResult, Team, TeamAggregateOdds } from '../data/types'
import { divergingColor, hexToRgb, readableTextColor, rgbToCss, tint, type RGB } from '../utils/divergingColor'

interface TeamSpotlightProps {
  team: Team
  teams: Team[]
  onChangeTeam: (teamId: string) => void
  odds: TeamAggregateOdds | null
  trialsRun: number
  remainingGames: Game[]
  teamsById: Record<string, Team>
  sensitivityResults: SensitivityResult[] | null
  overrides: Map<string, string>
  onSetPick: (gameId: string, result: string | null) => void
}

function pct(n: number | undefined | null): string {
  if (n == null) return '—'
  if (n >= 99.95) return '100%'
  if (n <= 0.05) return '0%'
  return `${n.toFixed(1)}%`
}

export function TeamSpotlight({
  team,
  teams,
  onChangeTeam,
  odds,
  trialsRun,
  remainingGames,
  teamsById,
  sensitivityResults,
  overrides,
  onSetPick,
}: TeamSpotlightProps) {
  const ownGames = useMemo(
    () => remainingGames.filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id),
    [remainingGames, team.id]
  )

  const sensitivityByGameId = useMemo(() => {
    const map = new Map<string, SensitivityResult>()
    for (const r of sensitivityResults ?? []) map.set(r.gameId, r)
    return map
  }, [sensitivityResults])

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => `${a.conference}${a.division}${a.name}`.localeCompare(`${b.conference}${b.division}${b.name}`)),
    [teams]
  )

  const primaryRgb = hexToRgb(team.colorPrimary)
  const secondaryRgb = hexToRgb(team.colorSecondary)

  // The four conference outcomes a team can land in, mutually exclusive and
  // exhaustive — they always sum to 100%. Derived from the seed-level odds
  // we already have: seed 1 is the bye, seeds 2-4 are division winners who
  // host a wild-card game, seeds 5-7 are wild cards who always travel.
  const scenarios = odds
    ? [
        { label: 'Bye week', value: odds.byePct, rgb: primaryRgb },
        { label: 'Host wild card', value: odds.divisionPct - odds.byePct, rgb: tint(primaryRgb, 0.35) },
        { label: 'Wild card', value: odds.playoffPct - odds.divisionPct, rgb: tint(primaryRgb, 0.65) },
        { label: 'Out', value: 100 - odds.playoffPct, rgb: secondaryRgb },
      ]
    : []
  const maxScenario = Math.max(1, ...scenarios.map((s) => s.value))

  const pickRows = useMemo(() => {
    return ownGames.map((g) => {
      const isHome = g.homeTeamId === team.id
      const opponentId = isHome ? g.awayTeamId : g.homeTeamId
      const opponent = teamsById[opponentId]
      const swing = sensitivityByGameId.get(g.id)
      const ifWin = isHome ? swing?.playoffPctIfHomeWins : swing?.playoffPctIfAwayWins
      const ifLose = isHome ? swing?.playoffPctIfAwayWins : swing?.playoffPctIfHomeWins
      const baseline = odds?.playoffPct ?? 0
      const deltaWin = ifWin != null ? ifWin - baseline : null
      const deltaLose = ifLose != null ? ifLose - baseline : null
      return { game: g, isHome, opponent, ifWin, ifLose, deltaWin, deltaLose }
    })
  }, [ownGames, team.id, teamsById, sensitivityByGameId, odds])

  const maxAbsDelta = Math.max(
    0.1,
    ...pickRows.flatMap((r) => [r.deltaWin != null ? Math.abs(r.deltaWin) : 0, r.deltaLose != null ? Math.abs(r.deltaLose) : 0])
  )

  function cellStyle(delta: number | null): { background: string; color: string } {
    const t = delta == null ? 0 : delta / maxAbsDelta
    const rgb: RGB = divergingColor(t, primaryRgb, secondaryRgb)
    return { background: rgbToCss(rgb), color: readableTextColor(rgb) }
  }

  return (
    <section
      className="team-spotlight"
      style={
        {
          '--spotlight-primary': team.colorPrimary,
          '--spotlight-secondary': team.colorSecondary,
        } as React.CSSProperties
      }
    >
      <div className="spotlight-header">
        <h2>
          {team.location} {team.name}
        </h2>
        <select value={team.id} onChange={(e) => onChangeTeam(e.target.value)}>
          {sortedTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.location} {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="spotlight-headline">
        <div className="headline-stat">
          <div className="headline-number">{pct(odds?.playoffPct)}</div>
          <div className="headline-label">Chance to make the playoffs</div>
          <div className="headline-rule" />
          <div className="headline-caption">Based on {trialsRun.toLocaleString()} simulations.</div>
        </div>

        {odds && (
          <div className="scenario-table">
            <div className="scenario-table-header">
              <span>{team.conference} scenario</span>
              <span>Probability</span>
            </div>
            {scenarios.map((s) => (
              <div className="scenario-row" key={s.label}>
                <span className="scenario-label">{s.label}</span>
                <span className="scenario-pct">{pct(s.value)}</span>
                <div className="scenario-bar-track">
                  <div
                    className="scenario-bar"
                    style={{ width: `${Math.max(0, (s.value / maxScenario) * 100)}%`, background: rgbToCss(s.rgb) }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="spotlight-secondary-stats">
        <span>
          Win division: <strong>{pct(odds?.divisionPct)}</strong>
        </span>
        <span>
          Win Super Bowl: <strong>{pct(odds?.superBowlPct)}</strong>
        </span>
      </div>

      <h3>Pick outcomes for the {team.name}</h3>
      {ownGames.length === 0 ? (
        <p className="muted">No games left this regular season.</p>
      ) : !sensitivityResults ? (
        <p className="muted">Crunching the numbers on every remaining game…</p>
      ) : (
        <>
          <div className="pick-grid">
            <div className="pick-grid-header">
              <span>
                <span className="axis-tick" />
                If the {team.name} win
              </span>
              <span>
                <span className="axis-tick" />
                If the {team.name} lose
              </span>
            </div>
            {pickRows.map(({ game: g, isHome, opponent, ifWin, ifLose, deltaWin, deltaLose }) => {
              const pick = overrides.get(g.id)
              const winnerIsSelected = pick === team.id
              const loserWinnerIsSelected = pick === opponent?.id
              const winStyle = cellStyle(deltaWin)
              const loseStyle = cellStyle(deltaLose)
              return (
                <div className="pick-row" key={g.id}>
                  <button
                    type="button"
                    className="pick-cell"
                    style={winStyle}
                    onClick={() => onSetPick(g.id, winnerIsSelected ? null : team.id)}
                  >
                    <span className="pick-radio">{winnerIsSelected ? '●' : '○'}</span>
                    <span className="pick-team">{team.abbr}</span>
                    <span className="pick-pct">{pct(ifWin)}</span>
                  </button>
                  <button
                    type="button"
                    className="pick-cell"
                    style={loseStyle}
                    onClick={() => onSetPick(g.id, loserWinnerIsSelected ? null : (opponent?.id ?? null))}
                  >
                    <span className="pick-radio">{loserWinnerIsSelected ? '●' : '○'}</span>
                    <span className="pick-team">
                      {isHome ? '' : 'at '}
                      {opponent?.abbr ?? '?'}
                    </span>
                    <span className="pick-pct">{pct(ifLose)}</span>
                  </button>
                </div>
              )
            })}
          </div>

          <div className="diverging-legend">
            <div
              className="legend-bar"
              style={{
                background: `linear-gradient(to right, ${rgbToCss(primaryRgb)}, #ebe9e4, ${rgbToCss(secondaryRgb)})`,
              }}
            />
            <div className="legend-labels">
              <span className="legend-better">Better for the {team.name}</span>
              <span>Doesn't matter</span>
              <span className="legend-worse">Worse for the {team.name}</span>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
