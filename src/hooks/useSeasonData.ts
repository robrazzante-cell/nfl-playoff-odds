import { useEffect, useState } from 'react'
import type { EloRatings, Game, SeasonMeta } from '../data/types'

export interface SeasonData {
  games: Game[]
  meta: SeasonMeta
  ratings: EloRatings
}

export function useSeasonData() {
  const [data, setData] = useState<SeasonData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const metaRes = await fetch(`${import.meta.env.BASE_URL}data/meta.json`)
        if (!metaRes.ok) throw new Error(`Could not load meta.json (HTTP ${metaRes.status})`)
        const meta: SeasonMeta = await metaRes.json()

        const [scheduleRes, ratingsRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/schedule-${meta.season}.json`),
          fetch(`${import.meta.env.BASE_URL}data/seed-ratings.json`),
        ])
        if (!scheduleRes.ok) throw new Error(`Could not load schedule-${meta.season}.json`)
        if (!ratingsRes.ok) throw new Error('Could not load seed-ratings.json')

        const games: Game[] = await scheduleRes.json()
        const ratingsPayload: { ratings: EloRatings } = await ratingsRes.json()

        if (!cancelled) setData({ games, meta, ratings: ratingsPayload.ratings })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error }
}
