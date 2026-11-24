// The confirmation box shown before closing a program.
import { doStop } from "../actions/stop"
import { Line } from "../lib/line"
import { fit, wrapWords } from "../lib/text"
import { C, PADX, PADY, btnColors } from "../lib/theme"
import { me, state } from "../state"
import { backdrop, modal, modalText, renderer, set } from "../ui/renderer"

export function renderConfirmModal(): void {
  const c = state.confirm
  backdrop.visible = modal.visible = !!c || !!state.procModal
  if (!c) return
  const W = renderer.width
  const H = renderer.height
  const mw = Math.min(68, W - 4)
  const mh = 7 + 2 * PADY // 7 rows of content, plus padding top and bottom
  const iw = mw
  const P = " ".repeat(PADX)
  const force = c.sig === "SIGKILL"
  const what = c.proc ? "process" : "program"
  const risky = c.info.kind === "System" || c.info.kind === "Service" || c.p.user !== me
  modal.width = mw
  modal.height = mh
  modal.left = Math.max(0, Math.floor((W - mw) / 2))
  modal.top = Math.max(0, Math.floor((H - mh) / 2))

  const lines: Line[] = []
  const blank = () => lines.push(new Line().fill(iw))
  for (let i = 0; i < PADY; i++) blank()
  const verb = force ? "Force stop" : "Close"
  const esc = "esc"
  const head = P + fit(`${verb} “${c.label}”?`, iw - 2 * PADX - esc.length - 1).trimEnd()
  lines.push(new Line().add(head, "#ffffff").add(" ".repeat(Math.max(1, iw - PADX - esc.length - head.length))).add(esc, C.dim).fill(iw))
  blank()
  const msg = risky
    ? `This looks like ${c.p.user === me ? `a system ${what}` : `a ${what} owned by ${c.p.user}`}. Stopping it could make things misbehave or log you out. Are you sure?`
    : force
      ? `Are you sure you want to force stop this ${what}? It stops right away, and any unsaved work will be lost.`
      : `Are you sure you want to close this ${what}? It may ask you to save your work first.`
  const wrapped = wrapWords(msg, iw - 2 * PADX)
  for (let i = 0; i < 3; i++) lines.push(new Line().add(P + (wrapped[i] ?? ""), risky ? C.memRed : C.fg).fill(iw))
  blank()
  // buttons, left-aligned like the ones in the details column
  const yes = force ? " Force stop " : c.proc ? " Close process " : " Close program "
  const no = " Cancel "
  const btns = new Line().add(P)
  btns.btn(yes, doStop, ...btnColors(state.confirmFocus === 0))
  btns.add(" ")
  btns.btn(no, () => (state.confirm = null), ...btnColors(state.confirmFocus === 1))
  lines.push(btns.fill(iw))
  for (let i = 0; i < PADY; i++) blank()
  set(modalText, lines.slice(0, mh))
}
