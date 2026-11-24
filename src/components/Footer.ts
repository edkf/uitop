// Bottom rule and key hints.
import { back, enter, setSort } from "../actions/navigation"
import { startSearch } from "../actions/search"
import { askStop } from "../actions/stop"
import { Line } from "../lib/line"
import { C, PADX } from "../lib/theme"
import { state } from "../state"
import { footer, renderer, set } from "../ui/renderer"

export function renderFooter(W: number, dividers: number[]): void {
  // a thin rule separates the instructions from the body; it meets the column dividers with ┴
  let t = ""
  for (let x = 0; x < W; x++) t += dividers.includes(x) ? "┴" : "─"
  const rule = new Line().add(t, C.sep)
  const l = new Line()
  if (state.status) return set(footer, [rule, l.add(" " + state.status, "#ffffff").fill(W)])
  l.add(" ".repeat(PADX - 1))
  const key = (k: string, label: string, fn: () => void) => {
    l.btn(` ${k}`, fn, "#ffffff", null)
    l.btn(` ${label} `, fn, "#ffffff", null)
  }
  key("←", "Back", back)
  key("→", "Open", enter)
  key("/", "Search", startSearch)
  key("c", "CPU", () => setSort("cpu"))
  key("m", "Memory", () => setSort("mem"))
  key("n", "Name", () => setSort("name"))
  key("x", "Close", () => askStop("SIGTERM"))
  key("␣", state.paused ? "Resume" : "Pause", () => (state.paused = !state.paused))
  key("?", "Help", () => (state.help = !state.help))
  key("q", "Quit", () => renderer.destroy())
  set(footer, [rule, l.fill(W)])
}
