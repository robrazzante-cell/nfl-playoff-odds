import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Team } from '../data/types'

interface OddsOverTimeChartProps {
  team: Team
  teams: Team[]
}

interface HistorySnapshot {
  week: number
  teamOdds: Record<string, { playoffPct: number }>
}

interface ChartRow {
  week: number
  [teamId: string]: number
}

export function OddsOverTimeChart({ team, teams }: OddsOverTimeChartProps) {
  const [rows, setRows] = useState<ChartRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const indexRes = await fetch(`${import.meta.env.BASE_URL}data/history/index.json`)
        if (!indexRes.ok) {
          if (!cancelled) setError('No odds history yet — check back after the first snapshot is saved.')
          return
        }
        const index: { weeks: number[] } = await indexRes.json()
        const snapshots = await Promise.all(
          index.weeks.map(async (week) => {
            const res = await fetch(`${import.meta.env.BASE_URL}data/history/week-${String(week).padStart(2, '0')}.json`)
            return (await res.json()) as HistorySnapshot
          })
        )
        if (cancelled) return
        const built: ChartRow[] = snapshots
          .sort((a, b) => a.week - b.week)
          .map((snap) => {
            const row: ChartRow = { week: snap.week }
            for (const teamId of Object.keys(snap.teamOdds)) row[teamId] = snap.teamOdds[teamId].playoffPct
            return row
          })
        setRows(built)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="muted">{error}</p>
  if (!rows) return <p className="muted">Loading odds history…</p>
  if (rows.length === 0) return <p className="muted">No odds history yet — check back after the first snapshot is saved.</p>

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="week" tickFormatter={(w) => `Wk ${w}`} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={40} />
          <Tooltip
            formatter={(value, name) => {
              const numeric = typeof value === 'number' ? value : Number(value)
              const t = teams.find((tm) => tm.id === String(name))
              return [`${numeric.toFixed(1)}%`, t ? `${t.location} ${t.name}` : String(name)]
            }}
            labelFormatter={(w) => `Week ${w}`}
          />
          {teams
            .filter((t) => t.id !== team.id)
            .map((t) => (
              <Line
                key={t.id}
                type="monotone"
                dataKey={t.id}
                stroke="#9ca3af"
                strokeOpacity={0.25}
                dot={false}
                strokeWidth={1}
                isAnimationActive={false}
              />
            ))}
          <Line
            type="monotone"
            dataKey={team.id}
            stroke={team.colorPrimary}
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
