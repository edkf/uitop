// Closing and force-stopping programs, plus the status notice.
import { Target, infoOf, me, state, target } from "../state"
import { app } from "../ui/hooks"

export function flash(msg: string): void {
  state.status = msg
  setTimeout(() => {
    state.status = ""
    app.render()
  }, 4000)
}
export function askStop(sig: NodeJS.Signals, pick?: Target): void {
  const t = pick ?? target()
  if (!t) return
  const label = t.procs.length > 1 ? `${t.label} (${t.procs.length} processes)` : t.label
  state.confirm = { p: t.p, label, info: infoOf(t.p), sig, procs: t.procs, proc: t.proc }
  const risky = sig === "SIGKILL" || t.procs.some((p) => ["System", "Service"].includes(infoOf(p).kind) || p.user !== me)
  state.confirmFocus = risky ? 1 : 0 // risky actions default to "No"
}
export function doStop(): void {
  const c = state.confirm
  state.confirm = null
  state.procModal = null
  if (!c) return
  const errs: any[] = []
  for (const p of c.procs) {
    try {
      process.kill(p.pid, c.sig)
    } catch (e: any) {
      errs.push(e)
    }
  }
  if (errs.length === 0) return flash(`Asked "${c.label}" to ${c.sig === "SIGKILL" ? "stop immediately" : "close"}. It disappears from the list if that worked.`)
  if (errs.length < c.procs.length) return flash(`Asked "${c.label}" to ${c.sig === "SIGKILL" ? "stop" : "close"}, but ${errs.length} of ${c.procs.length} processes could not be reached.`)
  const e = errs[0]
  flash(
    e.code === "EPERM"
      ? `Not allowed: "${c.label}" belongs to ${c.p.user}, not you.`
      : e.code === "ESRCH"
        ? `"${c.label}" is already gone.`
        : `Couldn't stop "${c.label}": ${e.message}`,
  )
}
