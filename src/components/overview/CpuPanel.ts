// CPU: headline, history chart and one meter per core.
import { BLOCKS, chart } from "./Chart"
import { flushRight, meter, meterW } from "./Meter"
import { panel } from "./Panel"
import { Metrics } from "./metrics"
import { sortBy } from "./sortBy"
import { fmtDur } from "../../lib/format"
import { Line } from "../../lib/line"
import { C, pctColor } from "../../lib/theme"
import { state } from "../../state"

export const cpuPanel = (m: Metrics) => (pw: number, ph: number): Line[] => {
  const [cpuWordL, cpuC] = m.cpu
  return panel(
    "CPU",
    pw,
    ph,
    (iw, ih) => {
      const L: Line[] = []
      const lead = new Line().add(" ").btn(`${m.cpuPct.toFixed(0)}%`, sortBy("cpu", "CPU use"), cpuC, null)
      lead.add("  ").add(cpuWordL, cpuC)
      flushRight(lead, iw, meter(m.cpuPct, meterW(iw), cpuC))
      L.push(lead)
      const G = 3 // gutter between the columns of cores
      const span = iw - 2 // same width as the chart above, so both end at the box padding
      const colsN = Math.max(1, Math.min(4, Math.floor((span + G) / (18 + G))))
      const rowsN = Math.ceil(state.cpu.length / colsN)
      const GAP = 1 // a blank row between the big chart and the small rows below it
      const full = ih - 1 - GAP - rowsN
      const chartH = full >= 3 ? full : Math.max(0, ih - 2 - GAP)
      for (const l of chart(state.hist.cpu, iw - 2, chartH)) L.push(new Line().add(" ").append(l))
      if (chartH > 0) L.push(new Line())
      if (full >= 3) {
        // column widths add up to exactly `span`, so the last meter ends where the chart ends
        const room = span - G * (colsN - 1)
        const cellW = Array.from({ length: colsN }, (_, c) => Math.floor(room / colsN) + (c < room % colsN ? 1 : 0))
        for (let r = 0; r < rowsN; r++) {
          const l = new Line().add(" ")
          for (let c = 0; c < colsN; c++) {
            const i = c * rowsN + r
            if (i >= state.cpu.length) break
            const start = l.x
            const v = state.cpu[i]!
            const bar = meter(v, 8, pctColor(v))
            l.add(`C${i + 1}`.padEnd(4), C.dim)
            l.add(" ".repeat(Math.max(1, cellW[c]! - 4 - 4 - 1 - bar.x))).add(`${v.toFixed(0)}%`.padStart(4), C.dim).add(" ").append(bar)
            if (c < colsN - 1) l.add(" ".repeat(Math.max(0, start + cellW[c]! + G - l.x)))
          }
          L.push(l)
        }
      } else {
        const l = new Line().add(" Cores ", C.dim)
        for (const v of state.cpu) l.add(BLOCKS[Math.max(1, Math.round((Math.min(100, v) / 100) * 8))]!, pctColor(v))
        L.push(l)
      }
      return L
    },
    { accent: cpuC, right: `last ${fmtDur(Math.min(state.hist.cpu.length, 400) * 1.5)}` },
  )
}
