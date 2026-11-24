// The Overview dashboard: a 2 × 3 grid of blocks joined by thin lines.
import { navEdgeBg } from "../Browse"
import { aboutPanel } from "./AboutPanel"
import { cpuPanel } from "./CpuPanel"
import { memPanel } from "./MemoryPanel"
import { hjoin, splitW } from "./Panel"
import { programsPanel } from "./ProgramsPanel"
import { topCpuPanel, topMemPanel } from "./TopList"
import { getMetrics } from "./metrics"
import { Line, pad } from "../../lib/line"
import { C, mode } from "../../lib/theme"
import { state } from "../../state"
import { listView, set } from "../../ui/renderer"

export function renderOverview(ow: number, B: number): void {
  mode.mono = false // the dashboard uses colour; lists stay white
  try {
    draw(ow, B)
  } finally {
    mode.mono = true
  }
}

function draw(ow: number, B: number): void {
  const cw = ow - 1 // inside the left divider
  const m = getMetrics()
  // ---- arrange into a grid that fills the viewport ----
  // Blocks sit in rows; a full-width rule with proper joints (┬ ┼ ┴) separates the rows, so every line touches.
  type Spec = { weight: number; make: (w: number, h: number) => Line[] }
  const blocks: Line[] = []
  const seps = (ws: number[]) => ws.slice(0, -1).map((_, j) => ws.slice(0, j + 1).reduce((a, b) => a + b, 0) + j)
  const ruleRow = (above: number[], below: number[]): Line => {
    let t = ""
    for (let x = 0; x < cw; x++) t += above.includes(x) ? (below.includes(x) ? "┼" : "┴") : below.includes(x) ? "┬" : "─"
    const l = new Line().add(t, C.sep)
    l.rule = true
    return l
  }
  let above: number[] = []
  const grid = (specs: Spec[], h: number) => {
    const ws = splitW(cw, specs.map((x) => x.weight))
    if (blocks.length) blocks.push(ruleRow(above, seps(ws))) // rules go between rows, not above the first
    blocks.push(...hjoin(specs.map((x, i) => x.make(ws[i]!, h))))
    above = seps(ws)
  }
  if (cw >= 70) {
    // 3 rows × 2 columns. The first row takes whatever the other two don't need.
    const avail = B - 2 // two rule rows between the three rows of blocks
    let r2 = 9
    let r3 = 10
    let r1 = avail - r2 - r3
    while (r1 < 11 && (r3 > 8 || r2 > 8)) {
      if (r3 > 8) r3--
      else r2--
      r1++
    }
    r1 = Math.max(6, r1)
    grid([{ weight: 1, make: cpuPanel(m) }, { weight: 1, make: memPanel(m) }], r1)
    grid([{ weight: 1, make: topCpuPanel(m) }, { weight: 1, make: topMemPanel(m) }], r2)
    grid([{ weight: 1, make: programsPanel(m) }, { weight: 1, make: aboutPanel(m) }], r3)
  } else {
    for (const [mkp, h] of [[cpuPanel(m), 12], [memPanel(m), 11], [topCpuPanel(m), 10], [topMemPanel(m), 10], [programsPanel(m), 10], [aboutPanel(m), 13]] as const) {
      if (blocks.length) blocks.push(ruleRow([], []))
      blocks.push(...mkp(cw, h))
    }
  }
  state.bottomSeps = above
  const lines = blocks.slice(0, B).map((l) => {
    const out = new Line().add(l.rule ? "├" : "│", C.sep).append(l.clip(cw).fill(cw))
    out.rule = l.rule
    return out
  })
  set(listView, pad(lines, B, ow, true, 0, navEdgeBg))
}
