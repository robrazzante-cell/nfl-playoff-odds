import { useMemo, useState } from 'react'
import type { SensitivityResult, Team } from '../data/types'

interface GamesThatMatterProps {
  team: Team
  teamsById: Record<string, Team>
  sensitivityResults: SensitivityResult[] | null
  loading: boolean
}

interface RankedGame {
  gameId: string
  impact: number
  description: string
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`
}

export function GamesThatMatter({ team, teamsById, sensitivityResults, loading }: GamesThatMatterProps) {
  const [showAll, setShowAll] = useState(false)

  const ranked = useMemo<RankedGame[]>(() => {
    if (!sensitivityResults) return []
    return sensitivityResults
      .map((r) => {
        const impact = Math.abs(r.playoffPctIfHomeWins - r.playoffPctIfAwayWins)
        const home = teamsById[r.homeTeamId]
        const away = teamsById[r.awayTeamId]
        const betterIsHome = r.playoffPctIfHomeWins >= r.playoffPctIfAwayWins

        let description: string
        if (r.homeTeamId === team.id || r.awayTeamId === team.id) {
          const opponent = r.homeTeamId === team.id ? away : home
          description = `Win vs ${opponent?.abbr ?? 'opponent'}: ${impact >= 0.05 ? `+${pct(impact)}` : 'negligible'}`
        } else {
          const favored = betterIsHome ? home : away
          const other = betterIsHome ? away : home
          description =
            impact >= 0.05
              ? `Root for ${favored?.abbr ?? '?'} over ${other?.abbr ?? '?'}: +${pct(impact)}`
              : `${home?.abbr ?? '?'} vs ${away?.abbr ?? '?'}: negligible effect`
        }

        return { gameId: r.gameId, impact, description }
      })
      .sort((a, b) => b.impact - a.impact)
  }, [sensitivityResults, teamsById, team.id])

  const visible = showAll ? ranked : ranked.slice(0, 15)

  return (
    <section className="games-that-matter">
      <h3>Games that matter most for the {team.name}</h3>
      {loading && <p className="muted">Crunching the numbers on every remaining game…</p>}
      {!loading && ranked.length === 0 && <p className="muted">No remaining games to analyze.</p>}
      {!loading && ranked.length > 0 && (
        <>
          <ol className="matter-list">
            {visible.map((g) => (
              <li key={g.gameId}>{g.description}</li>
            ))}
          </ol>
          {ranked.length > 15 && (
            <button type="button" onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Show fewer' : `Show all ${ranked.length} games`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
