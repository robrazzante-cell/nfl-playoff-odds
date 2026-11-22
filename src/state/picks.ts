// Encodes/decodes what-if picks to and from the URL so a scenario can be
// shared with a link. Format: `?picks=<gameId>:<winnerTeamId|TIE>,...`
// (teamIds and gameIds are short digit strings from ESPN, so this stays compact).

import type { GameOverride } from '../data/types'

const PARAM = 'picks'

export function encodePicks(overrides: GameOverride[]): string {
  return overrides.map((o) => `${o.gameId}:${o.result}`).join(',')
}

export function decodePicks(encoded: string): GameOverride[] {
  if (!encoded) return []
  return encoded
    .split(',')
    .map((pair) => {
      const [gameId, result] = pair.split(':')
      return gameId && result ? { gameId, result } : null
    })
    .filter((o): o is GameOverride => o !== null)
}

export function readPicksFromUrl(): GameOverride[] {
  if (typeof window === 'undefined') return []
  const params = new URLSearchParams(window.location.search)
  return decodePicks(params.get(PARAM) ?? '')
}

export function writePicksToUrl(overrides: GameOverride[]): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (overrides.length === 0) {
    params.delete(PARAM)
  } else {
    params.set(PARAM, encodePicks(overrides))
  }
  const query = params.toString()
  const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`
  window.history.replaceState(null, '', newUrl)
}
