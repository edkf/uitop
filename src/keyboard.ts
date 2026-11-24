// Keyboard handling.
import { back, enter, moveNav, moveSel, setSort } from "./actions/navigation"
import { closeSpot, jumpTo, spotMove, spotResults, startSearch } from "./actions/search"
import { askStop, doStop } from "./actions/stop"
import { state } from "./state"
import { app } from "./ui/hooks"
import { renderer } from "./ui/renderer"

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
      askStop(state.btn === 0 ? "SIGTERM" : "SIGKILL")
      return true
    }
    return false // up/down fall through (down enters the process list)
  }
  if (key.name === "return" || key.name === "right" || key.name === "l") {
    state.zone = "buttons" // act on the process that is highlighted
    state.btn = 0
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
        setSort("cpu")
        break
      case "m":
        setSort("mem")
        break
      case "n":
        setSort("name")
        break
      case "r":
        state.desc = !state.desc
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
