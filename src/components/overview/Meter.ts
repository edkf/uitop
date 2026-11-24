// Small horizontal meters and the helpers that place them.
import { Line } from "../../lib/line"
import { C } from "../../lib/theme"

export const meter = (pct: number, w: number, c: string): Line => {
  const f = Math.round((Math.min(100, pct) / 100) * w)
  return new Line().add("█".repeat(f), c).add("░".repeat(Math.max(0, w - f)), C.barBg)
}

// every meter sits on the right of its row, with the label/value on the left
export const meterW = (iw: number) => Math.min(20, Math.max(8, Math.floor(iw / 3)))
export const flushRight = (l: Line, iw: number, bar: Line) => l.add(" ".repeat(Math.max(1, iw - 1 - l.x - bar.x))).append(bar)
