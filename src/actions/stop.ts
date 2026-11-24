// Closing and force-stopping programs, plus the status notice.
import { infoOf, me, state, target } from "../state"
import { app } from "../ui/hooks"

export function flash(msg: string): void {
  state.status = msg
  setTimeout(() => {
    state.status = ""
    app.render()
  }, 4000)
}
export function askStop(sig: NodeJS.Signals): void {
  const t = target()
  if (!t) return
  state.confirm = { p: t.p, label: t.label, info: infoOf(t.p), sig }
  const k = infoOf(t.p).kind
  const risky = sig === "SIGKILL" || k === "System" || k === "Service" || t.p.user !== me
  state.confirmFocus = risky ? 1 : 0 // risky actions default to "No"
}
export function doStop(): void {
  const c = state.confirm
  state.confirm = null
  if (!c) return
  try {
    process.kill(c.p.pid, c.sig)
    flash(`Asked "${c.label}" to ${c.sig === "SIGKILL" ? "stop immediately" : "close"}. It disappears from the list if that worked.`)
  } catch (e: any) {
    flash(
      e.code === "EPERM"
        ? `Not allowed: "${c.label}" belongs to ${c.p.user}, not you.`
        : e.code === "ESRCH"
          ? `"${c.label}" is already gone.`
          : `Couldn't stop "${c.label}": ${e.message}`,
    )
  }
}
