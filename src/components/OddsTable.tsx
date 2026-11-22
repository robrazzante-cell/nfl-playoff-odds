import { useMemo, useState } from 'react'
import type { Conference, Division, SimResponse, Team } from '../data/types'

interface OddsTableProps {
  teams: Team[]
  response: SimResponse | null
  onSelectTeam: (teamId: string) => void
}

type SortKey = 'playoffPct' | 'divisionPct' | 'byePct' | 'superBowlPct' | `seed${1 | 2 | 3 | 4 | 5 | 6 | 7}`

const CONFERENCES: Conference[] = ['AFC', 'NFC']
const DIVISIONS: Division[] = ['East', 'North', 'South', 'West']

function sortValue(response: SimResponse | null, teamId: string, key: SortKey): number {
  const odds = response?.teamOdds[teamId]
  if (!odds) return 0
  if (key.startsWith('seed')) return odds.seedPct[Number(key.slice(4))] ?? 0
  return odds[key as 'playoffPct' | 'divisionPct' | 'byePct' | 'superBowlPct']
}

function pct(n: number | undefined): string {
  if (n == null) return '—'
  if (n >= 99.95) return '100%'
  if (n <= 0.05) return '0%'
  return `${n.toFixed(1)}%`
}

export function OddsTable({ teams, response, onSelectTeam }: OddsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('playoffPct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const teamsByDivision = useMemo(() => {
    const map = new Map<string, Team[]>()
    for (const conference of CONFERENCES) {
      for (const division of DIVISIONS) {
        const key = `${conference}-${division}`
        const group = teams
          .filter((t) => t.conference === conference && t.division === division)
          .sort((a, b) => {
            const diff = sortValue(response, b.id, sortKey) - sortValue(response, a.id, sortKey)
            return sortDir === 'desc' ? diff : -diff
          })
        map.set(key, group)
      }
    }
    return map
  }, [teams, response, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function headerButton(key: SortKey, label: string) {
    const active = key === sortKey
    return (
      <th key={key} className={active ? 'sorted' : undefined}>
        <button type="button" onClick={() => toggleSort(key)}>
          {label}
          {active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
        </button>
      </th>
    )
  }

  return (
    <div className="odds-table-wrap">
      {CONFERENCES.map((conference) => (
        <div key={conference} className="conference-block">
          <h3>{conference}</h3>
          <div className="table-scroll">
            <table className="odds-table">
              <thead>
                <tr>
                  <th>Team</th>
                  {headerButton('playoffPct', 'Playoff')}
                  {headerButton('divisionPct', 'Division')}
                  {headerButton('byePct', 'Bye')}
                  {([1, 2, 3, 4, 5, 6, 7] as const).map((s) => headerButton(`seed${s}`, `#${s}`))}
                  {headerButton('superBowlPct', 'Super Bowl')}
                </tr>
              </thead>
              {DIVISIONS.map((division) => {
                const key = `${conference}-${division}`
                const group = teamsByDivision.get(key) ?? []
                return (
                  <tbody key={key}>
                    <tr className="division-row">
                      <th colSpan={11}>
                        {conference} {division}
                      </th>
                    </tr>
                    {group.map((team) => {
                      const odds = response?.teamOdds[team.id]
                      return (
                        <tr key={team.id}>
                          <td>
                            <button
                              type="button"
                              className="team-cell"
                              style={{ '--team-color': team.colorPrimary } as React.CSSProperties}
                              onClick={() => onSelectTeam(team.id)}
                            >
                              <span className="team-dot" />
                              {team.location} {team.name}
                            </button>
                          </td>
                          <td className="num">{pct(odds?.playoffPct)}</td>
                          <td className="num">{pct(odds?.divisionPct)}</td>
                          <td className="num">{pct(odds?.byePct)}</td>
                          {([1, 2, 3, 4, 5, 6, 7] as const).map((s) => (
                            <td key={s} className="num">
                              {pct(odds?.seedPct[s])}
                            </td>
                          ))}
                          <td className="num">{pct(odds?.superBowlPct)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
