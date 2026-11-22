// A diverging color scale for "how much does this outcome help or hurt a
// team's odds" — modeled on the NYT Upshot playoff simulator's blue/gold
// scale, but using the spotlighted team's own colors: `positiveRgb` for
// outcomes that help (scales toward it as the delta grows), `negativeRgb`
// for outcomes that hurt, and a neutral gray for "doesn't matter much."

export type RGB = [number, number, number]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** `t` is a signed fraction in [-1, 1] — positive helps, negative hurts. */
export function divergingColor(t: number, positiveRgb: RGB, negativeRgb: RGB, neutralRgb: RGB = [235, 233, 228]): RGB {
  const clamped = Math.max(-1, Math.min(1, t))
  const target = clamped >= 0 ? positiveRgb : negativeRgb
  const magnitude = Math.abs(clamped)
  return [
    lerp(neutralRgb[0], target[0], magnitude),
    lerp(neutralRgb[1], target[1], magnitude),
    lerp(neutralRgb[2], target[2], magnitude),
  ]
}

export function rgbToCss([r, g, b]: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

/** Perceived luminance in [0, 1] — used to decide whether text should be dark or light on a given background. */
export function luminance([r, g, b]: RGB): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function readableTextColor(bg: RGB): string {
  return luminance(bg) < 0.58 ? '#ffffff' : '#1a1a1a'
}

/** Lightens an RGB color toward white by `amount` (0 = unchanged, 1 = white). */
export function tint(rgb: RGB, amount: number): RGB {
  return [lerp(rgb[0], 255, amount), lerp(rgb[1], 255, amount), lerp(rgb[2], 255, amount)]
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return [r, g, b]
}
