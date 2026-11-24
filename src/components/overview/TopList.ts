// "Using the most CPU / memory": ranked lists; clicking a row jumps to the process.
import { reveal } from "../../actions/navigation"
import { meter } from "./Meter"
import { panel } from "./Panel"
import { Metrics } from "./metrics"
import { Proc } from "../../data/system"
import { fmtMem } from "../../lib/format"
import { Line } from "../../lib/line"
import { fit } from "../../lib/text"
import { C, memColor, pctColor } from "../../lib/theme"
import { infoOf, state } from "../../state"

const topList = (title: string, rank: Proc[], val: (p: Proc) => [string, string, number]) => (pw: number, ph: number): Line[] =>
  panel(
    title,
    pw,
    ph,
    (iw, ih) =>
      rank.slice(0, ih).map((p, i) => {
        const [text, c, pct] = val(p)
        const l = new Line()
        const nameW = Math.max(6, iw - 3 - 6 - text.length - 2)
        l.append(new Line().add(` ${i + 1} `, C.dim).add(fit(infoOf(p).name, nameW), C.fg).add(" " + text, c).add(" ").append(meter(pct, 5, c)))
        l.zones.push({ x0: 0, x1: iw, fn: () => reveal(p.pid) })
        return l
      }),
    { right: "click to open" },
  )

export const topCpuPanel = (_m: Metrics) =>
  topList("Using the most CPU", [...state.procs].sort((a, b) => b.cpu - a.cpu), (p) => [`${p.cpu.toFixed(1)}%`.padStart(6), pctColor(p.cpu * 2), p.cpu])

export const topMemPanel = (_m: Metrics) =>
  topList("Using the most memory", [...state.procs].sort((a, b) => b.rss - a.rss), (p) => [fmtMem(p.rss).padStart(7), memColor(p.rss), (p.rss / 1048576) * 25])
