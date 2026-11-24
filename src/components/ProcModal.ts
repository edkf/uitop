// The box shown when a process inside a group is picked: its details, and a way to close just that one.
import { askStop } from "../actions/stop"
import { Line } from "../lib/line"
import { fit } from "../lib/text"
import { C, PADX, PADY, btnColors } from "../lib/theme"
import { statusWord } from "../model/describe"
import { infoOf, state } from "../state"
import { backdrop, modal, modalText, renderer, set } from "../ui/renderer"
import { processRows } from "./ProcRows"

export const closeProc = () => (state.procModal = null)

export function renderProcModal(): void {
  const pm = state.procModal
  const p = pm && state.procs.find((q) => q.pid === pm.pid)
  if (pm && !p) state.procModal = null // the process is gone
  if (!pm || !p || state.confirm) return
  backdrop.visible = modal.visible = true
  const W = renderer.width
  const H = renderer.height
  const mw = Math.min(72, W - 4)
  const P = " ".repeat(PADX)
  const lead = () => new Line().add(" ".repeat(PADX - 1))
  const name = infoOf(p).name
  const sw = statusWord(p.stat)

  const lines: Line[] = []
  const blank = () => lines.push(new Line().fill(mw))
  for (let i = 0; i < PADY; i++) blank()
  const esc = "esc"
  const head = P + fit(name, mw - 2 * PADX - esc.length - 1).trimEnd()
  lines.push(new Line().add(head, "#ffffff").add(" ".repeat(Math.max(1, mw - PADX - esc.length - head.length))).add(esc, C.dim).fill(mw))
  lines.push(new Line().add(P).add(fit(`${sw.word}: ${sw.why}`, mw - 2 * PADX).trimEnd(), sw.color).fill(mw))
  blank()
  const btns = new Line().add(P)
  const go = (sig: NodeJS.Signals) => askStop(sig, { p, label: name, procs: [p], proc: true })
  btns.btn(" Close process ", () => go("SIGTERM"), ...btnColors(state.procFocus === 0)).add(" ")
  btns.btn(" Force stop ", () => go("SIGKILL"), ...btnColors(state.procFocus === 1)).add(" ")
  btns.btn(" Cancel ", closeProc, ...btnColors(state.procFocus === 2))
  lines.push(btns.fill(mw))
  blank()
  const rule = new Line().add(P).add("─".repeat(Math.max(0, mw - 2 * PADX)), C.sep)
  lines.push(rule.fill(mw))
  for (const r of processRows(p, mw - PADX + 1, lead)) lines.push(r.fill(mw))
  for (let i = 0; i < PADY; i++) blank()

  const mh = Math.min(lines.length, H - 2)
  modal.width = mw
  modal.height = mh
  modal.left = Math.max(0, Math.floor((W - mw) / 2))
  modal.top = Math.max(0, Math.floor((H - mh) / 2))
  set(modalText, lines.slice(0, mh))
}
