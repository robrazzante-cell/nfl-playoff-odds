import { useMemo } from 'react'
import { winProbability, type EloConfig } from '../elo/elo'
import type { EloRatings, Game, SensitivityResult, Team, TeamAggregateOdds } from '../data/types'

interface TeamSpotlightProps {
  team: Team
  teams: Team[]
  onChangeTeam: (teamId: string) => void
  odds: TeamAggregateOdds | null
  remainingGames: Game[]
  teamsById: Record<string, Team>
  currentRatings: EloRatings
  config: EloConfig
  sensitivityResults: SensitivityResult[] | null
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
  remainingGames,
  teamsById,
  currentRatings,
  config,
  sensitivityResults,
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

      <div className="spotlight-odds">
        <div className="odds-stat">
          <span className="odds-value">{pct(odds?.playoffPct)}</span>
          <span className="odds-label">Make playoffs</span>
        </div>
        <div className="odds-stat">
          <span className="odds-value">{pct(odds?.divisionPct)}</span>
          <span className="odds-label">Win division</span>
        </div>
        <div className="odds-stat">
          <span className="odds-value">{pct(odds?.byePct)}</span>
          <span className="odds-label">#1 seed / bye</span>
        </div>
        <div className="odds-stat">
          <span className="odds-value">{pct(odds?.superBowlPct)}</span>
          <span className="odds-label">Win Super Bowl</span>
        </div>
      </div>

      <h3>Remaining schedule</h3>
      {ownGames.length === 0 ? (
        <p className="muted">No games left this regular season.</p>
      ) : (
        <ul className="spotlight-schedule">
          {ownGames.map((g) => {
            const isHome = g.homeTeamId === team.id
            const opponentId = isHome ? g.awayTeamId : g.homeTeamId
            const opponent = teamsById[opponentId]
            const homeRating = currentRatings[g.homeTeamId] ?? config.meanRating
            const awayRating = currentRatings[g.awayTeamId] ?? config.meanRating
            const teamWinProb = isHome
              ? winProbability(homeRating, awayRating, config, false)
              : 1 - winProbability(homeRating, awayRating, config, false)
            const swing = sensitivityByGameId.get(g.id)
            const ifWin = isHome ? swing?.playoffPctIfHomeWins : swing?.playoffPctIfAwayWins
            const ifLose = isHome ? swing?.playoffPctIfAwayWins : swing?.playoffPctIfHomeWins

            return (
              <li key={g.id} className="spotlight-game">
                <span className="opponent">
                  {isHome ? 'vs' : '@'} {opponent?.location} {opponent?.name} (Week {g.week})
                </span>
                <span className="win-prob">{pct(teamWinProb * 100)} win chance</span>
                {swing && (
                  <span className="swing">
                    Playoff odds: {pct(ifWin)} if win, {pct(ifLose)} if lose
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
