// Programs per section; clicking a row opens that section.
import { setNav } from "../../actions/navigation"
import { panel } from "./Panel"
import { Metrics } from "./metrics"
import { fmtMem } from "../../lib/format"
import { Line } from "../../lib/line"
import { fit } from "../../lib/text"
import { C, memColor, pctColor } from "../../lib/theme"
import { state } from "../../state"

export const programsPanel = (_m: Metrics) => (pw: number, ph: number): Line[] => {
  const working = state.procs.filter((p) => p.stat.startsWith("R")).length
  return panel(
    "Categories",
    pw,
    ph,
    (iw, ih) =>
      state.model.sections.filter((s) => !s.isAll).slice(0, ih).map((sec) => {
        const nameW = Math.max(6, iw - 1 - 4 - 1 - 6 - 1 - 8 - 1)
        const l = new Line().add(" ").add(fit(sec.name, nameW), C.fg).add(String(sec.n).padStart(4) + " ", C.dim)
        l.add((sec.cpu.toFixed(1) + "%").padStart(6) + " ", pctColor(sec.cpu * 2)).add(fmtMem(sec.rss).padStart(8), memColor(sec.rss))
        l.zones.push({ x0: 0, x1: iw, fn: () => setNav(sec.name) })
        return l
      }),
    { right: `${state.procs.length} running · ${working} working` },
  )
}
