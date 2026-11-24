// Memory: headline, history chart and the swap row.
import { chart } from "./Chart"
import { flushRight, meter, meterW } from "./Meter"
import { panel } from "./Panel"
import { Metrics } from "./metrics"
import { sortBy } from "./sortBy"
import { fmtBytes } from "../../lib/format"
import { Line } from "../../lib/line"
import { C, levelColor } from "../../lib/theme"
import { state } from "../../state"

export const memPanel = (m: Metrics) => (pw: number, ph: number): Line[] => {
  const [memWordL, memC] = m.memory
  const mem = state.mem
  return panel(
    "Memory",
    pw,
    ph,
    (iw, ih) => {
      const L: Line[] = []
      const lead = new Line().add(" ").btn(fmtBytes(mem.used), sortBy("mem", "memory use"), memC, null)
      lead.add(` of ${fmtBytes(mem.total)}`, C.dim).add("  ").add(memWordL, memC)
      flushRight(lead, iw, meter(m.memPct, meterW(iw), memC))
      L.push(lead)
      const swapLines = mem.swapTotal > 0 ? 1 : 0
      const memH = Math.max(0, ih - 1 - swapLines - (swapLines ? 1 : 0)) // keep a blank row above the swap row
      for (const l of chart(state.hist.mem, iw - 2, memH, (v) => levelColor("mem", v))) L.push(new Line().add(" ").append(l))
      if (swapLines) {
        if (memH > 0) L.push(new Line())
        const sw = new Line().add(" Swap  ", C.dim).add(`${fmtBytes(mem.swapUsed)} / ${fmtBytes(mem.swapTotal)}`, m.swapPct < 25 ? C.fg : levelColor("swap", m.swapPct))
        L.push(flushRight(sw, iw, meter(m.swapPct, meterW(iw), levelColor("swap", m.swapPct))))
      }
      return L
    },
    { accent: memC, right: `${m.memPct.toFixed(0)}% used` },
  )
}
