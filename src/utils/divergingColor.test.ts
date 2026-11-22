import { describe, expect, it } from 'vitest'
import { divergingColor, luminance, readableTextColor } from './divergingColor'

const POS: [number, number, number] = [71, 42, 8]
const NEG: [number, number, number] = [255, 60, 0]
const NEUTRAL: [number, number, number] = [235, 233, 228]

describe('divergingColor', () => {
  it('returns the neutral color at t=0', () => {
    expect(divergingColor(0, POS, NEG, NEUTRAL)).toEqual(NEUTRAL)
  })

  it('returns the positive color at t=1', () => {
    expect(divergingColor(1, POS, NEG, NEUTRAL)).toEqual(POS)
  })

  it('returns the negative color at t=-1', () => {
    expect(divergingColor(-1, POS, NEG, NEUTRAL)).toEqual(NEG)
  })

  it('clamps values outside [-1, 1]', () => {
    expect(divergingColor(5, POS, NEG, NEUTRAL)).toEqual(divergingColor(1, POS, NEG, NEUTRAL))
    expect(divergingColor(-5, POS, NEG, NEUTRAL)).toEqual(divergingColor(-1, POS, NEG, NEUTRAL))
  })
})

describe('readableTextColor', () => {
  it('picks white text for a dark background', () => {
    expect(readableTextColor([20, 20, 20])).toBe('#ffffff')
  })

  it('picks dark text for a light background', () => {
    expect(readableTextColor([245, 245, 245])).toBe('#1a1a1a')
  })

  it('luminance is monotonic with brightness', () => {
    expect(luminance([0, 0, 0])).toBeLessThan(luminance([255, 255, 255]))
  })
})
