import { useMemo, useState } from 'react'
import type { Game, Team } from '../data/types'

interface WhatIfPickerProps {
  remainingGames: Game[]
  teamsById: Record<string, Team>
  overrides: Map<string, string>
  onSetPick: (gameId: string, result: string | null) => void
  onResetWeek: (week: number) => void
  onResetAll: () => void
}

export function WhatIfPicker({
  remainingGames,
  teamsById,
  overrides,
  onSetPick,
  onResetWeek,
  onResetAll,
}: WhatIfPickerProps) {
  const byWeek = useMemo(() => {
    const map = new Map<number, Game[]>()
    for (const g of remainingGames) {
      const list = map.get(g.week) ?? []
      list.push(g)
      map.set(g.week, list)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [remainingGames])

  const [expandedWeeks, setExpandedWeeks] = useState<Set<number> | null>(null)
  // Default to just the soonest upcoming week open, once we know what that is.
  const effectiveExpanded =
    expandedWeeks ?? new Set(byWeek.length > 0 ? [byWeek[0][0]] : [])

  function toggleWeek(week: number) {
    const next = new Set(effectiveExpanded)
    if (next.has(week)) next.delete(week)
    else next.add(week)
    setExpandedWeeks(next)
  }

  if (remainingGames.length === 0) {
    return <p className="muted">No games left to pick — the regular season is complete.</p>
  }

  return (
    <div className="what-if-picker">
      <div className="what-if-header">
        <p className="muted">
          Pick a winner for any remaining game to see how it changes the odds. Picks are saved in the page's URL,
          so you can copy the link to share your scenario.
        </p>
        <button type="button" className="reset-all" onClick={onResetAll} disabled={overrides.size === 0}>
          Reset all picks
        </button>
      </div>

      {byWeek.map(([week, games]) => {
        const weekHasPicks = games.some((g) => overrides.has(g.id))
        const weekPickCount = games.filter((g) => overrides.has(g.id)).length
        const isExpanded = effectiveExpanded.has(week)
        return (
          <div key={week} className="week-block">
            <div className="week-header">
              <button type="button" className="week-toggle" onClick={() => toggleWeek(week)}>
                <span className={isExpanded ? 'chevron open' : 'chevron'}>▶</span>
                <h4>
                  Week {week}
                  {weekPickCount > 0 ? ` (${weekPickCount} pick${weekPickCount > 1 ? 's' : ''})` : ''}
                </h4>
              </button>
              <button type="button" onClick={() => onResetWeek(week)} disabled={!weekHasPicks}>
                Reset week
              </button>
            </div>
            {isExpanded && (
            <ul className="game-list">
              {games.map((g) => {
                const home = teamsById[g.homeTeamId]
                const away = teamsById[g.awayTeamId]
                const pick = overrides.get(g.id)
                return (
                  <li key={g.id} className="game-row">
                    <button
                      type="button"
                      className={pick === g.awayTeamId ? 'team-pick selected' : 'team-pick'}
                      onClick={() => onSetPick(g.id, pick === g.awayTeamId ? null : g.awayTeamId)}
                    >
                      {away?.abbr ?? g.awayTeamId}
                    </button>
                    <span className="at">@</span>
                    <button
                      type="button"
                      className={pick === g.homeTeamId ? 'team-pick selected' : 'team-pick'}
                      onClick={() => onSetPick(g.id, pick === g.homeTeamId ? null : g.homeTeamId)}
                    >
                      {home?.abbr ?? g.homeTeamId}
                    </button>
                    <button
                      type="button"
                      className={pick === 'TIE' ? 'tie-pick selected' : 'tie-pick'}
                      onClick={() => onSetPick(g.id, pick === 'TIE' ? null : 'TIE')}
                    >
                      Tie
                    </button>
                  </li>
                )
              })}
            </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
