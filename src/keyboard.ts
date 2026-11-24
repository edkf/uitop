// Keyboard handling.
import { back, enter, moveNav, moveSel, setSort } from "./actions/navigation"
import { closeSpot, jumpTo, spotMove, spotResults, startSearch } from "./actions/search"
import { askStop, doStop } from "./actions/stop"
import { openProc } from "./actions/navigation"
import { closeProc } from "./components/ProcModal"
import { Target, groupTarget, infoOf, state } from "./state"
import { app } from "./ui/hooks"
import { renderer } from "./ui/renderer"

const procTarget = (): Target | undefined => {
  const pm = state.procModal
  const p = pm && state.procs.find((q) => q.pid === pm.pid)
  return p ? { p, label: infoOf(p).name, procs: [p], proc: true } : undefined
}

/** Keys for the action buttons / process list in the right column. Returns true if handled. */
export function actionKeys(key: { name: string }): boolean {
  if (state.zone === "buttons") {
    if (key.name === "left" || key.name === "h") {
      if (state.btn === 1) state.btn = 0
      else back()
      return true
    }
    if (key.name === "right" || key.name === "l") {
      state.btn = 1
      return true
    }
    if (key.name === "return") {
      askStop(state.btn === 0 ? "SIGTERM" : "SIGKILL", groupTarget())
      return true
    }
    return false // up/down fall through (down enters the process list)
  }
  if (key.name === "return" || key.name === "right" || key.name === "l") {
    openProc()
    return true
  }
  return false
}

renderer.keyInput.on("keypress", (key) => {
  const page = Math.max(1, renderer.height - 5)
  if (state.spot.open) {
    const sp = state.spot
    if (key.name === "escape") closeSpot()
    else if (key.name === "return") {
      const p = spotResults()[sp.sel]
      if (p) jumpTo(p.pid)
    } else if (key.name === "up" || (key.ctrl && key.name === "p")) spotMove(-1)
    else if (key.name === "down" || (key.ctrl && key.name === "n")) spotMove(1)
    else if (key.name === "pageup") spotMove(-8)
    else if (key.name === "pagedown") spotMove(8)
    else if (key.name === "backspace") ((sp.query = sp.query.slice(0, -1)), (sp.sel = 0))
    else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= " ") ((sp.query += key.sequence), (sp.sel = 0))
  } else if (state.help) {
    state.help = false
  } else if (state.confirm) {
    if (key.name === "y") doStop()
    else if (key.name === "n" || key.name === "escape") state.confirm = null
    else if (key.name === "return") (state.confirmFocus === 0 ? doStop() : (state.confirm = null))
    else if (["left", "right", "tab", "h", "l"].includes(key.name)) state.confirmFocus = state.confirmFocus === 0 ? 1 : 0
  } else if (state.procModal) {
    const f = state.procFocus
    if (key.name === "escape" || key.name === "n") closeProc()
    else if (key.name === "x") askStop("SIGTERM", procTarget())
    else if (key.sequence === "X") askStop("SIGKILL", procTarget())
    else if (key.name === "return") (f === 2 ? closeProc() : askStop(f === 0 ? "SIGTERM" : "SIGKILL", procTarget()))
    else if (key.name === "left" || key.name === "h") state.procFocus = Math.max(0, f - 1) as 0 | 1 | 2
    else if (key.name === "right" || key.name === "l") state.procFocus = Math.min(2, f + 1) as 0 | 1 | 2
    else if (key.name === "tab") state.procFocus = ((f + (key.shift ? 2 : 1)) % 3) as 0 | 1 | 2
  } else if (state.focus === 2 && actionKeys(key)) {
    // handled by the right column
  } else {
    switch (key.name) {
      case "q":
        renderer.destroy()
        return
      case "up":
      case "k":
        moveSel(-1)
        break
      case "down":
      case "j":
        moveSel(1)
        break
      case "pageup":
        moveSel(-page)
        break
      case "pagedown":
        moveSel(page)
        break
      case "home":
        moveSel(-1e9)
        break
      case "end":
        moveSel(1e9)
        break
      case "right":
      case "l":
      case "return":
        enter()
        break
      case "left":
      case "h":
        back()
        break
      case "escape":
        if (state.focus > 0) back()
        break
      case "tab":
        moveNav(key.shift ? -1 : 1)
        break
      case "c":
        setSort("cpu", state.focus === 2)
        break
      case "m":
        setSort("mem", state.focus === 2)
        break
      case "n":
        setSort("name", state.focus === 2)
        break
      case "r":
        if (state.focus === 2) state.mdesc = !state.mdesc
        else state.desc = !state.desc
        break
      case "x":
      case "delete":
        askStop(key.sequence === "X" ? "SIGKILL" : "SIGTERM")
        break
      case "space":
        state.paused = !state.paused
        break
      default:
        if (key.sequence === "/") startSearch()
        else if (key.sequence === "?") state.help = true
        else if (key.sequence === "X") askStop("SIGKILL")
    }
  }
  app.render()
})
