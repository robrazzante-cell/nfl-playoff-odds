import { describe, expect, it } from 'vitest'
import { decodePicks, encodePicks } from './picks'

describe('picks encoding', () => {
  it('round-trips a list of overrides through the URL-safe string format', () => {
    const overrides = [
      { gameId: '401547417', result: '5' },
      { gameId: '401547418', result: 'TIE' },
    ]
    const encoded = encodePicks(overrides)
    expect(decodePicks(encoded)).toEqual(overrides)
  })

  it('returns an empty array for an empty string', () => {
    expect(decodePicks('')).toEqual([])
  })
})
