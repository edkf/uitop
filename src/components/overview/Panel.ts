// A titled block, joining blocks side by side, and splitting a width.
import { Line, shiftLine } from "../../lib/line"
import { C, PADX, PADY } from "../../lib/theme"
import { body } from "../../ui/renderer"

/** A borderless block of exactly w×h: PADY blank rows, a title, the body, PADY blank rows. Horizontal padding is PADX. */
export function panel(title: string, w: number, h: number, body: (iw: number, ih: number) => Line[], o: { accent?: string; right?: string; onTitle?: () => void } = {}): Line[] {
  const ex = PADX - 1
  const iw = Math.max(1, w - 2 * ex) // bodies carry their own 1-column margin, so ex more makes PADX
  const ih = Math.max(0, h - 1 - 2 * PADY)
  const rows: Line[] = []
  for (let i = 0; i < PADY; i++) rows.push(new Line().fill(w))
  const top = new Line().add(" ".repeat(PADX))
  if (o.onTitle) top.btn(title, o.onTitle, C.text, null)
  else top.add(title, C.text)
  const right = o.right && title.length + o.right.length + 2 * PADX + 4 <= w ? o.right : ""
  if (right) top.add(" ".repeat(Math.max(1, w - top.x - right.length - PADX))).add(right, C.dim)
  rows.push(top.clip(w).fill(w))
  const lines = body(iw, ih)
  for (let i = 0; i < ih; i++) rows.push(shiftLine((lines[i] ?? new Line()).clip(iw).fill(iw), ex, 0).fill(w))
  for (let i = 0; i < PADY; i++) rows.push(new Line().fill(w))
  return rows
}

export function hjoin(panels: Line[][]): Line[] {
  const h = Math.max(...panels.map((p) => p.length))
  const out: Line[] = []
  for (let i = 0; i < h; i++) {
    const l = new Line()
    panels.forEach((p, j) => {
      if (j) l.add("│", C.sep)
      l.append(p[i] ?? new Line())
    })
    out.push(l)
  }
  return out
}

export const splitW = (total: number, weights: number[]): number[] => {
  const avail = total - (weights.length - 1)
  const sum = weights.reduce((a, b) => a + b, 0)
  const ws = weights.map((x) => Math.floor((avail * x) / sum))
  ws[ws.length - 1]! += avail - ws.reduce((a, b) => a + b, 0)
  return ws
}
