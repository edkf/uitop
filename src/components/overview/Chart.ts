// Area chart for a 0-100 history.
import { Line } from "../../lib/line"
import { C, pctColor } from "../../lib/theme"

export const BLOCKS = " ▁▂▃▄▅▆▇█"

/** Multi-row area chart of a 0-100 history; newest value on the right. */
export function chart(vals: number[], w: number, h: number, colorOf: (v: number) => string = pctColor): Line[] {
  const data = vals.slice(-w)
  const rows: Line[] = []
  for (let r = 0; r < h; r++) {
    const fromBottom = h - 1 - r
    const l = new Line().add(" ".repeat(w - data.length))
    let run = ""
    let runColor = ""
    const flush = () => run && (l.add(run, runColor), (run = ""))
    for (const v of data) {
      const eighths = Math.round((Math.min(100, Math.max(0, v)) / 100) * h * 8)
      const fill = Math.max(0, Math.min(8, eighths - fromBottom * 8))
      const ch = fill ? BLOCKS[fill]! : r === h - 1 ? "▁" : " "
      const c = fill ? colorOf(v) : C.barBg
      if (c !== runColor) (flush(), (runColor = c))
      run += ch
    }
    flush()
    rows.push(l)
  }
  return rows
}
