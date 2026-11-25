// The quick-search box.
import { jumpTo, spotResults } from "../actions/search"
import { fmtMem } from "../lib/format"
import { Line } from "../lib/line"
import { fit } from "../lib/text"
import { C, PADX, PADY, memColor } from "../lib/theme"
import { infoOf, state } from "../state"
import { backdrop, renderer, set, spotBox, spotText } from "../ui/renderer"

export function renderSearchModal(): void {
  const open = state.spot.open
  spotBox.visible = open
  backdrop.visible = backdrop.visible || open
  if (!open) return
  const W = renderer.width
  const H = renderer.height
  const mw = Math.min(78, W - 4)
  const R = Math.max(3, Math.min(9, H - 10 - 2 * PADY))
  const mh = R + 2 + 2 * PADY
  const P = " ".repeat(PADX)
  const iw = mw
  spotBox.width = mw
  spotBox.height = mh
  spotBox.left = Math.max(0, Math.floor((W - mw) / 2))
  spotBox.top = Math.max(0, Math.floor((H - mh) / 2))

  const results = spotResults()
  state.spot.sel = Math.max(0, Math.min(state.spot.sel, Math.max(0, results.length - 1)))
  const sp = state.spot
  if (sp.sel < sp.top) sp.top = sp.sel
  if (sp.sel >= sp.top + R) sp.top = sp.sel - R + 1
  sp.top = Math.max(0, Math.min(sp.top, Math.max(0, results.length - R)))

  const lines: Line[] = []
  const q = sp.query
  for (let i = 0; i < PADY; i++) lines.push(new Line().fill(iw))
  const esc = "esc"
  const room = iw - 2 * PADX - 2 - esc.length - 2
  const shown = q ? fit(q, room - 1).trimEnd() : fit("type a name, a PID or part of a command…", room).trimEnd()
  const gap = Math.max(1, iw - PADX - esc.length - (PADX + 2 + shown.length + (q ? 1 : 0)))
  lines.push(new Line().add(P + "⌕ ", C.fg).add(shown, q ? C.text : C.dim).add(q ? "█" : "", C.text).add(" ".repeat(gap)).add(esc, C.dim).fill(iw))
  lines.push(new Line().fill(iw)) // space between the input and the results

  const nameW = Math.max(8, iw - 2 * PADX - 1 - 6 - 1 - 8)
  for (let i = sp.top; i < sp.top + R; i++) {
    const p = results[i]
    if (!p) {
      lines.push(new Line().fill(iw))
      continue
    }
    const on = i === sp.sel
    const bg = on ? C.selBg : undefined
    const l = new Line().add(P, C.fg, { bg })
    l.add(fit(infoOf(p).name, nameW), on ? C.selFg : C.text, { bg })
    l.add(" ", C.fg, { bg })
    l.add((p.cpu.toFixed(1) + "%").padStart(6) + " ", on ? C.selFg : C.fg, { bg })
    l.add(fmtMem(p.rss).padStart(8), on ? C.selFg : memColor(p.rss), { bg })
    l.fill(iw, bg)
    l.zones.push({ x0: 0, x1: iw, fn: () => jumpTo(p.pid) })
    lines.push(l)
  }
  if (!results.length) lines[2 + PADY] = new Line().add(P + "Nothing found. Try a shorter word.", C.dim).fill(iw)
  for (let i = 0; i < PADY; i++) lines.push(new Line().fill(iw))
  set(spotText, lines.slice(0, mh))
}
