// Right column: details, actions and the processes inside a group.
import { askStop } from "../actions/stop"
import { listEdgeBg } from "./List"
import { processRows } from "./ProcRows"
import { sortHeader } from "./SortHeader"
import { ICON_COLS, iconRows } from "../lib/appIcon"
import { fmtMem } from "../lib/format"
import { Line, pad } from "../lib/line"
import { fit } from "../lib/text"
import { C, COLGAP, PADX, PADY, btnColors, chunk, memColor, pctColor } from "../lib/theme"
import { kindColor, statusWord } from "../model/describe"
import { curItem, curSection, groupTarget, infoOf, memberIdx, membersOf, state } from "../state"
import { detailsView, set } from "../ui/renderer"

export const focusedBtn = () => (state.focus === 2 && state.zone === "buttons" ? state.btn : -1)
export function actionLine(w: number, t: unknown, fb = -1): Line {
  const l = new Line().add("│", C.sep).add(" ")
  if (!t) return l.fill(w)
  l.btn(" Close program ", () => askStop("SIGTERM", groupTarget()), ...btnColors(fb === 0)).add(" ")
  l.btn(" Force stop ", () => askStop("SIGKILL", groupTarget()), ...btnColors(fb === 1))
  return l.fill(w)
}

export function renderDetails(ow: number, B: number): void {
  const ex = PADX - 1
  const w = ow - 2 * ex
  const sec = curSection()
  const it = curItem()
  const sep = () => new Line().add("│", C.sep)
  const lines: Line[] = []
  state.col3Map = []
  for (let i = 0; i < PADY; i++) lines.push(sep().fill(w))
  if (!sec || !it) return set(detailsView, pad([], B, ow, true, ex, listEdgeBg))

  // the app's icon sits alone on top of the header, with the title and the rest underneath
  for (const row of iconRows(it.p.command, infoOf(it.p).icon)) lines.push(sep().add(" ").append(row).fill(w))
  lines.push(sep().fill(w))
  const members = membersOf(it)
  const isGroup = members.length > 0
  lines.push(sep().add(" ", C.fg).add(fit(it.label,Math.max(6, w - 2)).trimEnd(), C.text).fill(w))

  if (isGroup) {
    lines.push(sep().add(` ${it.n} processes together: `, C.dim).add(`${it.cpu.toFixed(1)}% CPU`, pctColor(it.cpu * 2)).add(" · ", C.dim).add(fmtMem(it.rss), memColor(it.rss)).fill(w))
    lines.push(sep().fill(w)) // same rows as a single process, so the buttons sit at the same height
    lines.push(actionLine(w, groupTarget(), focusedBtn()))
    lines.push(sep().fill(w))
    const headerRows = lines.length
    const h = Math.max(1, B - headerRows - 2 - PADY)
    const idx = memberIdx(members)
    if (state.follow && state.focus === 2 && state.zone === "list" && idx >= 0) {
      if (idx < state.top3) state.top3 = idx
      if (idx >= state.top3 + h) state.top3 = idx - h + 1
    }
    state.top3 = Math.max(0, Math.min(state.top3, Math.max(0, members.length - h)))
    const right = 1 + 6 + COLGAP + 8
    const nameW = Math.max(6, w - 1 - 1 - right - 1)
    const heading = sep().add(" ", C.fg)
    sortHeader(heading, `Processes inside (${members.length})`, "name", nameW + 1, false, true)
    sortHeader(heading, "CPU", "cpu", 6, true, true)
    heading.add(" ".repeat(COLGAP))
    sortHeader(heading, "Memory", "mem", 8, true, true)
    lines.push(heading.fill(w))
    const rule3 = new Line().add("├", C.sep).add("─".repeat(Math.max(0, w - 1)), C.sep)
    rule3.rule = true
    lines.push(rule3)
    for (let i = state.top3; i < Math.min(members.length, state.top3 + h); i++) {
      const p = members[i]!
      const picked = state.focus === 2 && !!state.memberKey && i === idx
      const on = picked && state.zone === "list"
      const bg = on ? C.selBg : picked ? C.inactiveSel : undefined
      const mc = memColor(p.rss) // heavy memory tints the whole row
      const l = new Line().add(bg ? "▐" : "│", bg ?? C.sep).add(" ", C.fg, { bg })
      l.add(fit(infoOf(p).name, nameW).trimEnd(), on ? C.selFg : kindColor[infoOf(p).kind], { bg })
      l.add(" ".repeat(Math.max(0, 1 + 1 + nameW + 1 - l.x)), C.fg, { bg })
      l.add((p.cpu.toFixed(1) + "%").padStart(6) + " ".repeat(COLGAP), p.cpu > 0.4 && mc !== C.fg ? mc : on ? C.selFg : p.cpu > 0.4 ? pctColor(p.cpu * 2) : C.dim, { bg })
      l.add(fmtMem(p.rss).padStart(8), on ? (mc !== C.fg ? mc : C.selFg) : mc, { bg })
      state.col3Map[lines.length] = i
      lines.push(l.fill(w, bg))
    }
  } else {
    const p = it.p
    const sw = statusWord(p.stat)
    lines.push(sep().add(" ", C.fg).add(fit(`${sw.word}: ${sw.why}`, Math.max(0, w - 3)).trimEnd(), sw.color).fill(w))
    lines.push(sep().fill(w)) // same rows as the group header, so the buttons sit at the same height
    lines.push(actionLine(w, groupTarget(), focusedBtn()))
    lines.push(sep().fill(w))
    lines.push(sep().add(" Details", C.text).fill(w))
    const rule = new Line().add("├", C.sep).add("─".repeat(Math.max(0, w - 1)), C.sep)
    rule.rule = true
    lines.push(rule)
    lines.push(...processRows(p, w, sep))
  }
  // the middle column's heading rule ends here, so join it to this column's divider
  if (lines[2 + PADY]) lines[2 + PADY]!.chunks[0] = chunk("┤", C.sep)
  set(detailsView, pad(lines, B, ow, true, ex, listEdgeBg))
}
