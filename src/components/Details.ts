// Right column: details, actions and the processes inside a group.
import { askStop } from "../actions/stop"
import { listEdgeBg } from "./List"
import { sortHeader } from "./SortHeader"
import { Proc } from "../data/system"
import { fmtMem } from "../lib/format"
import { Line, pad } from "../lib/line"
import { fit, wrap } from "../lib/text"
import { C, COLGAP, PADX, PADY, chunk, memColor, pctColor } from "../lib/theme"
import { cpuWord, kindColor, statusWord } from "../model/describe"
import { curItem, curSection, infoOf, me, memberIdx, membersOf, state, target } from "../state"
import { detailsView, set } from "../ui/renderer"

export const focusedBtn = () => (state.focus === 2 && state.zone === "buttons" ? state.btn : -1)
export function actionLine(w: number, t: { p: Proc; label: string } | undefined, fb = -1): Line {
  const l = new Line().add("│", C.sep).add(" ")
  if (!t) return l.fill(w)
  l.btn(" Close program ", () => askStop("SIGTERM"), "#ffffff", fb === 0 ? C.headerBg : C.btnBg).add(" ")
  l.btn(" Force stop ", () => askStop("SIGKILL"), "#ffffff", fb === 1 ? C.headerBg : C.btnBg)
  return l.fill(w)
}

export function renderDetails(ow: number, B: number): void {
  const ex = PADX - 1
  const w = ow - 2 * ex
  const sec = curSection()
  const it = curItem()
  const sep = () => new Line().add("│", C.sep)
  const kv = (k: string, v: string, fg = C.fg) => sep().add(" " + k.padEnd(12), C.dim).add(fit(v, Math.max(0, w - 15)).trimEnd(), fg).fill(w)
  const lines: Line[] = []
  state.col3Map = []
  for (let i = 0; i < PADY; i++) lines.push(sep().fill(w))
  if (!sec || !it) return set(detailsView, pad([], B, ow, true, ex, listEdgeBg))

  const members = membersOf(it)
  const isGroup = members.length > 0
  const info = infoOf(it.p)
  lines.push(sep().add(" ", C.fg).add(fit(it.label, Math.max(6, w - 2)).trimEnd(), "#ffffff").fill(w))

  if (isGroup) {
    lines.push(sep().add(` ${it.n} processes together: `, C.dim).add(`${it.cpu.toFixed(1)}% CPU`, pctColor(it.cpu * 2)).add(" · ", C.dim).add(fmtMem(it.rss), memColor(it.rss)).fill(w))
    const t = target()
    if (state.focus === 2 && state.memberKey && t) {
      const sw = statusWord(t.p.stat)
      lines.push(sep().add(" Selected: ", C.dim).add(fit(t.label, Math.max(6, w - 24)).trimEnd(), "#ffffff").add(" · ", C.dim).add(sw.word, sw.color).fill(w))
    } else {
      lines.push(sep().fill(w)) // keeps the height stable when a process gets picked
    }
    lines.push(actionLine(w, t, focusedBtn()))
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
    sortHeader(heading, `Processes inside (${members.length})`, "name", nameW + 1)
    sortHeader(heading, "CPU", "cpu", 6, true)
    heading.add(" ".repeat(COLGAP))
    sortHeader(heading, "Memory", "mem", 8, true)
    lines.push(heading.fill(w))
    const rule3 = new Line().add("├", C.sep).add("─".repeat(Math.max(0, w - 1)), C.sep)
    rule3.rule = true
    lines.push(rule3)
    for (let i = state.top3; i < Math.min(members.length, state.top3 + h); i++) {
      const p = members[i]!
      const picked = state.focus === 2 && !!state.memberKey && i === idx
      const on = picked && state.zone === "list"
      const bg = on ? C.selBg : picked ? C.inactiveSel : undefined
      const l = new Line().add(bg ? "▐" : "│", bg ?? C.sep).add(" ", C.fg, { bg })
      l.add(fit(infoOf(p).name, nameW).trimEnd(), on ? C.selFg : kindColor[infoOf(p).kind], { bg })
      l.add(" ".repeat(Math.max(0, 1 + 1 + nameW + 1 - l.x)), C.fg, { bg })
      l.add((p.cpu.toFixed(1) + "%").padStart(6) + " ".repeat(COLGAP), on ? C.selFg : p.cpu > 0.4 ? pctColor(p.cpu * 2) : C.dim, { bg })
      l.add(fmtMem(p.rss).padStart(8), on ? C.selFg : memColor(p.rss), { bg })
      state.col3Map[lines.length] = i
      lines.push(l.fill(w, bg))
    }
  } else {
    const p = it.p
    const sw = statusWord(p.stat)
    const parent = state.procs.find((q) => q.pid === p.ppid)
    lines.push(sep().add(" Using ", C.dim).add(cpuWord(p.cpu), pctColor(p.cpu * 2)).add(` of the CPU (${p.cpu.toFixed(1)}%)`, C.dim).fill(w))
    lines.push(sep().add(" and ", C.dim).add(fmtMem(p.rss), memColor(p.rss)).add(` of memory (${p.mem.toFixed(1)}% of your RAM)`, C.dim).fill(w))
    lines.push(sep().fill(w))
    lines.push(kv("Status", `${sw.word}: ${sw.why}`, sw.color))
    lines.push(kv("Process ID", String(p.pid)))
    lines.push(kv("Started by", parent ? `${infoOf(parent).name} (PID ${parent.pid})` : p.ppid <= 1 ? "the system" : `PID ${p.ppid}`))
    lines.push(kv("Owner", p.user === me ? `you (${p.user})` : p.user))
    lines.push(kv("CPU time", `${p.time} used in total`))
    lines.push(kv("Virtual", `${fmtMem(p.vsz)} reserved (not real memory use)`))
    lines.push(sep().fill(w))
    lines.push(actionLine(w, target(), focusedBtn()))
    lines.push(sep().fill(w))
    lines.push(sep().add(" Where it lives", C.dim).fill(w))
    for (const s of wrap(info.path, w - 3).slice(0, 3)) lines.push(sep().add(" " + s, C.fg).fill(w))
    if (p.command !== info.path) {
      lines.push(sep().fill(w))
      lines.push(sep().add(" Full command", C.dim).fill(w))
      for (const s of wrap(p.command, w - 3).slice(0, 6)) lines.push(sep().add(" " + s, C.dim).fill(w))
    }
  }
  // the middle column's heading rule ends here, so join it to this column's divider
  if (lines[2 + PADY]) lines[2 + PADY]!.chunks[0] = chunk("┤", C.sep)
  set(detailsView, pad(lines, B, ow, true, ex, listEdgeBg))
}
