// Middle column: the programs of the selected section.
import { navEdgeBg } from "./Browse"
import { sortHeader } from "./SortHeader"
import { fmtMem } from "../lib/format"
import { Line, pad } from "../lib/line"
import { fit } from "../lib/text"
import { C, COLGAP, PADX, PADY, memColor, pctColor } from "../lib/theme"
import { kindColor } from "../model/describe"
import { OVERVIEW } from "../model/types"
import { curSection, itemIdx, state } from "../state"
import { listView, set } from "../ui/renderer"

/** Background of the selected list row at body row `y`, so its highlight reaches the divider on its right. */
export const listEdgeBg = (y: number): string | undefined => {
  const sec = curSection()
  if (!sec || state.help || state.nav === OVERVIEW) return undefined
  const rowY = PADY + 3 + (itemIdx(sec) - state.top2) // blank, title, heading, rule, then the items
  return y === rowY ? (state.focus === 1 ? C.selBg : C.inactiveSel) : undefined
}

export function renderList(ow: number, B: number): void {
  const ex = PADX - 1
  const w = ow - 2 * ex // usable width inside the padding
  const sec = curSection()
  const sep = (l: Line) => l.add("│", C.sep)
  const lines: Line[] = []
  for (let i = 0; i < PADY; i++) lines.push(sep(new Line()).fill(w))
  if (!sec) {
    lines.push(sep(new Line()).add(" Nothing here.", C.yellow).fill(w))
    return set(listView, pad(lines, B, ow, true, ex, navEdgeBg))
  }
  lines.push(sep(new Line()).add(` ${sec.name}`, "#ffffff").add(` (${sec.n})`, C.dim).fill(w))

  const right = 1 + 6 + COLGAP + 8
  const nameW = Math.max(6, w - 1 - 1 - right - 1)
  // column headings double as sort buttons
  const heading = sep(new Line()).add(" ", C.fg)
  sortHeader(heading, "Name", "name", nameW + 1)
  sortHeader(heading, "CPU", "cpu", 6, true)
  heading.add(" ".repeat(COLGAP))
  sortHeader(heading, "Memory", "mem", 8, true)
  lines.push(heading.fill(w))
  const rule2 = new Line().add("├", C.sep).add("─".repeat(Math.max(0, w - 1)), C.sep)
  rule2.rule = true
  lines.push(rule2)

  const h = B - 3 - 2 * PADY
  const idx = itemIdx(sec)
  if (state.follow && idx >= 0) {
    if (idx < state.top2) state.top2 = idx
    if (idx >= state.top2 + h) state.top2 = idx - h + 1
  }
  state.top2 = Math.max(0, Math.min(state.top2, Math.max(0, sec.items.length - h)))

  for (let i = state.top2; i < Math.min(sec.items.length, state.top2 + h); i++) {
    const it = sec.items[i]!
    const on = i === idx
    const bg = on ? (state.focus === 1 ? C.selBg : C.inactiveSel) : undefined
    const hot = on && state.focus === 1
    const l = new Line().add(bg ? "▐" : "│", bg ?? C.sep).add(" ", C.fg, { bg })
    const group = it.members.length > 1
    const more = group ? ` ×${it.n}` : ""
    l.add(fit(it.label, nameW - more.length).trimEnd(), hot ? C.selFg : on ? "#ffffff" : kindColor[it.kind], { bg })
    l.add(more, hot ? C.selFg : C.dim, { bg })
    l.add(" ".repeat(Math.max(0, 1 + 1 + nameW + 1 - l.x)), C.fg, { bg })
    l.add((it.cpu.toFixed(1) + "%").padStart(6) + " ".repeat(COLGAP), hot ? C.selFg : it.cpu > 0.4 ? pctColor(it.cpu * 2) : C.dim, { bg })
    l.add(fmtMem(it.rss).padStart(8), hot ? C.selFg : memColor(it.rss), { bg })
    lines.push(l.fill(w, bg))
  }
  set(listView, pad(lines, B, ow, true, ex, navEdgeBg))
}
