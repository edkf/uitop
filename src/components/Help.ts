// The help screen.
// Laid out like the Overview: titled blocks in a grid, joined by thin lines.
import { navEdgeBg } from "./Browse"
import { hjoin, panel, splitW } from "./overview/Panel"
import { Line, pad } from "../lib/line"
import { wrapWords } from "../lib/text"
import { C, PADX, PADY } from "../lib/theme"
import { state } from "../state"
import { body, listView, set } from "../ui/renderer"

export function renderHelp(ow: number, B: number): void {
  const cw = ow - 1 // inside the left divider
  type Block = { title: string; right?: string; body: (iw: number) => Line[] }
  type Pair = [string, string]
  const MARGIN = 1 // bodies keep a 1-column margin; the panel adds the rest of PADX

  /** "label  description" rows; the description wraps under itself. `chip` draws the label as a key cap. */
  const rows = (items: Pair[], labelW: number, chip: boolean) => (iw: number): Line[] => {
    const descW = Math.max(10, iw - MARGIN - labelW - 2 - (chip ? 2 : 0) - 1)
    const out: Line[] = []
    for (const [label, desc] of items) {
      wrapWords(desc, descW).forEach((part, i) => {
        const l = new Line().add(" ".repeat(MARGIN))
        if (i === 0) chip ? l.add(` ${label.padEnd(labelW)} `, "#ffffff", { bg: C.btnBg }) : l.add(label.padEnd(labelW), "#ffffff")
        else l.add(" ".repeat(labelW + (chip ? 2 : 0)))
        out.push(l.add("  " + part, C.fg))
      })
    }
    return out
  }

  const reading: Block = {
    title: "Reading the list",
    body: rows(
      [
        ["Name", "What is running. “Browser ×16” is a group: an app plus its 15 helper processes."],
        ["CPU", "How hard it makes the processor work. 100% is one full core."],
        ["Memory", "RAM it holds. Red means over 1 GB. Group totals are approximate."],
        ["Status", "Working = busy now · Idle = waiting (normal) · Paused · Stuck = a leftover."],
      ],
      8,
      false,
    ),
  }
  const types: Block = {
    title: "Program types",
    body: rows(
      [
        ["App", "something you opened"],
        ["Helper", "a part of an app"],
        ["System", "the operating system itself"],
        ["Service", "a background service, no window"],
        ["Dev", "a developer or terminal tool"],
        ["Other", "everything else"],
      ],
      8,
      false,
    ),
  }
  const keyboard: Block = {
    title: "Keyboard",
    body: rows(
      [
        ["↑ ↓   j k", "choose"],
        ["→  l  Enter", "go in (list → buttons → processes)"],
        ["←  h  Esc", "go back"],
        ["Tab", "next section"],
        ["/", "search every program"],
        ["c  m  n", "sort by CPU / Memory / Name"],
        ["x     X", "close / force stop"],
        ["space", "pause updates"],
        ["?     q", "help · quit"],
      ],
      11,
      true,
    ),
  }
  const mouse: Block = {
    title: "Mouse",
    body: rows(
      [
        ["Click", "select; click a group again to open it"],
        ["Wheel", "scroll the column under the pointer"],
        ["Headings", "click Name, CPU or Memory to sort"],
        ["Buttons", "Close program and Force stop ask first"],
        ["Overview", "click a name in the lists to jump to it"],
      ],
      9,
      false,
    ),
  }
  const careful: Block = {
    title: "Careful",
    right: "press any key or click to go back",
    body: (iw) => [new Line().add(" ".repeat(MARGIN) + "Stopping a program you don't recognise can lose unsaved work. When unsure, don't.", C.fg).clip(iw)],
  }

  // natural height of a block at width w, then every block in a row takes the tallest
  const natural = (b: Block, w: number) => b.body(Math.max(1, w - 2 * (PADX - 1))).length + 1 + 2 * PADY
  const build = (b: Block, w: number, h: number) => panel(b.title, w, h, (iw) => b.body(iw), { right: b.right })

  const blocks: Line[] = []
  const seps: number[][] = [] // per output line: where the vertical separators are (to join the footer rule)
  const sepsOf = (ws: number[]) => ws.slice(0, -1).map((_, j) => ws.slice(0, j + 1).reduce((a, b) => a + b, 0) + j)
  const ruleRow = (above: number[], below: number[]): Line => {
    let t = ""
    for (let x = 0; x < cw; x++) t += above.includes(x) ? (below.includes(x) ? "┼" : "┴") : below.includes(x) ? "┬" : "─"
    const l = new Line().add(t, C.sep)
    l.rule = true
    return l
  }
  let above: number[] = []
  let first = true
  const grid = (row: Block[]) => {
    const ws = splitW(cw, row.map(() => 1))
    const h = Math.max(...row.map((b, i) => natural(b, ws[i]!)))
    if (!first) {
      blocks.push(ruleRow(above, sepsOf(ws)))
      seps.push([])
    }
    first = false
    const lines = hjoin(row.map((b, i) => build(b, ws[i]!, h)))
    blocks.push(...lines)
    lines.forEach(() => seps.push(sepsOf(ws)))
    above = sepsOf(ws)
  }

  if (cw >= 90) {
    grid([reading, types])
    grid([keyboard, mouse])
    grid([careful])
  } else {
    for (const b of [reading, types, keyboard, mouse, careful]) grid([b])
  }

  const lines = blocks.slice(0, B).map((l) => {
    const out = new Line().add(l.rule ? "├" : "│", C.sep).append(l.clip(cw).fill(cw))
    out.rule = l.rule
    return out
  })
  state.bottomSeps = blocks.length >= B ? seps[B - 1] ?? [] : []
  set(listView, pad(lines, B, ow, true, 0, navEdgeBg))
}
