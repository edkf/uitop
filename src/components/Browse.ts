// Left column: Overview and the sections.
import { Line, pad } from "../lib/line"
import { fit } from "../lib/text"
import { C, PADX, PADY, SELECTED } from "../lib/theme"
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
  set(browseView, pad(lines, B, w, false))
}
