// Left column: Overview and the sections.
import { meter } from "./overview/Meter"
import { getMetrics } from "./overview/metrics"
import { Line, pad } from "../lib/line"
import { fit } from "../lib/text"
import { C, PADX, PADY, SELECTED, mode } from "../lib/theme"
import { state } from "../state"
import { browseView, set } from "../ui/renderer"

/** Background of the selected sidebar row at body row `y`, so its highlight reaches the divider line. */
export const navEdgeBg = (y: number): string | undefined =>
  y === PADY + state.model.navList.indexOf(state.nav) ? (state.focus === 0 ? C.selBg : C.inactiveSel) : undefined

export function renderBrowse(w: number, B: number): void {
  const lines: Line[] = []
  for (let i = 0; i < PADY; i++) lines.push(new Line().fill(w))
  for (const name of state.model.navList) {
    const on = name === state.nav
    const bg = on ? (state.focus === 0 ? C.selBg : C.inactiveSel) : undefined
    const hot = on && state.focus === 0
    const l = new Line().add(on ? SELECTED : " ", hot ? C.selFg : "#ffffff", { bg })
    l.add(fit(" " + name, w - 1 - PADX), hot ? C.selFg : on ? "#ffffff" : C.fg, { bg })
    lines.push(l.fill(w, bg))
  }
  // minimal CPU and memory meters pinned to the bottom of the column
  const need = 5 + PADY + 1
  if (w >= 12 && B - lines.length >= need) {
    mode.mono = false
    try {
      const m = getMetrics()
      const block = (name: string, pct: number, color: string) => {
        const iw = w - 2 * PADX
        const val = `${pct.toFixed(0)}%`
        const top = new Line().add(" ".repeat(PADX)).add(name, C.dim)
        top.add(" ".repeat(Math.max(1, PADX + iw - top.x - val.length))).add(val, color)
        return [top, new Line().add(" ".repeat(PADX)).append(meter(pct, iw, color))]
      }
      const tail = [...block("CPU", m.cpuPct, m.cpu[1]), new Line(), ...block("Memory", m.memPct, m.memory[1])]
      while (lines.length < B - tail.length - PADY) lines.push(new Line())
      lines.push(...tail)
    } finally {
      mode.mono = true
    }
  }
  set(browseView, pad(lines, B, w, false))
}
