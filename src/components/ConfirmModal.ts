// The confirmation box shown before closing a program.
import { doStop } from "../actions/stop"
import { Line } from "../lib/line"
import { fit, wrapWords } from "../lib/text"
import { C, PADX, PADY } from "../lib/theme"
import { me, state } from "../state"
import { backdrop, modal, modalText, renderer, set } from "../ui/renderer"

export function renderConfirmModal(): void {
  const c = state.confirm
  backdrop.visible = modal.visible = !!c
  if (!c) return
  const W = renderer.width
  const H = renderer.height
  const mw = Math.min(68, W - 4)
  const mh = 11 + 2 * PADY // 9 lines of content + padding top and bottom
  const iw = mw - 2
  const P = " ".repeat(PADX)
  const force = c.sig === "SIGKILL"
  const risky = c.info.kind === "System" || c.info.kind === "Service" || c.p.user !== me
  const accent = "#ffffff"
  modal.width = mw
  modal.height = mh
  modal.left = Math.max(0, Math.floor((W - mw) / 2))
  modal.top = Math.max(0, Math.floor((H - mh) / 2))
  modal.borderColor = accent
  ;(modal as any).title = force ? " Force stop " : " Close program "

  const lines: Line[] = []
  const blank = () => lines.push(new Line().fill(iw))
  for (let i = 0; i < PADY; i++) blank()
  lines.push(new Line().add(P + (force ? "Force stop " : "Close "), "#ffffff").add(fit(`“${c.label}”`, iw - 2 * PADX - 14).trimEnd(), accent).add(" ?", "#ffffff").fill(iw))
  lines.push(new Line().add(P + `PID ${c.p.pid} · ${c.p.user === me ? "yours" : "owned by " + c.p.user} · ${c.info.kind}`, C.dim).fill(iw))
  blank()
  const msg = risky
    ? "⚠ This looks like a system or another user's program. Stopping it can break things or log you out."
    : force
      ? "It stops immediately, so any unsaved work will be lost."
      : "The app may ask you to save your work first."
  const wrapped = wrapWords(msg, iw - 2 * PADX)
  lines.push(new Line().add(P + (wrapped[0] ?? ""), C.fg).fill(iw))
  lines.push(new Line().add(P + (wrapped[1] ?? ""), C.fg).fill(iw))
  blank()
  // buttons, centred
  const yes = force ? " Yes, force stop " : " Yes, close it "
  const no = " No, keep it "
  const total = yes.length + 3 + no.length
  const btns = new Line().add(" ".repeat(Math.max(1, Math.floor((iw - total) / 2))))
  btns.btn(yes, doStop, "#ffffff", state.confirmFocus === 0 ? C.headerBg : C.btnBg)
  btns.add("   ")
  btns.btn(no, () => (state.confirm = null), "#ffffff", state.confirmFocus === 1 ? C.headerBg : C.btnBg)
  lines.push(btns.fill(iw))
  blank()
  lines.push(new Line().add(P + "Enter confirm · ←/→ switch · Esc cancel · y / n", C.dim).fill(iw))
  for (let i = 0; i < PADY; i++) blank()
  set(modalText, lines.slice(0, mh - 2))
}
