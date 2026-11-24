// Line: one row of styled text with clickable zones, plus helpers to pad and shift rows.
import { StyledText, type TextChunk } from "@opentui/core"
import { C, Style, chunk } from "./theme"

/** One line of text that remembers where its clickable buttons are. */
export class Line {
  chunks: TextChunk[] = []
  zones: { x0: number; x1: number; fn: () => void }[] = []
  x = 0
  rule = false // a full-width horizontal rule row (gets a ├ joint at the left edge)
  add(text: string, fg = C.fg, o: Style = {}): this {
    this.chunks.push(chunk(text, fg, o))
    this.x += text.length
    return this
  }
  btn(text: string, fn: () => void, fg = "#ffffff", bg: string | null = C.btnBg): this {
    this.zones.push({ x0: this.x, x1: this.x + text.length, fn })
    return this.add(text, fg, { bg: bg ?? undefined })
  }
  fill(w: number, bg?: string): this {
    if (this.x < w) this.add(" ".repeat(w - this.x), C.fg, { bg })
    return this
  }
  /** Pad to `w` columns with the background of the last chunk (keeps a highlighted row going to the edge). */
  padRight(w: number): this {
    if (this.x < w) {
      const bg = this.chunks[this.chunks.length - 1]?.bg
      this.chunks.push({ ...chunk(" ".repeat(w - this.x)), bg })
      this.x = w
    }
    return this
  }
  /** Append another line, keeping its buttons clickable at their shifted position. */
  append(o: Line): this {
    const dx = this.x
    this.chunks.push(...o.chunks)
    for (const z of o.zones) this.zones.push({ x0: z.x0 + dx, x1: z.x1 + dx, fn: z.fn })
    this.x += o.x
    return this
  }
  /** Cut the line to at most `w` columns. */
  clip(w: number): this {
    if (this.x <= w) return this
    let x = 0
    const out: TextChunk[] = []
    for (const c of this.chunks) {
      if (x >= w) break
      const room = w - x
      out.push(c.text.length <= room ? c : { ...c, text: c.text.slice(0, room) })
      x += Math.min(c.text.length, room)
    }
    this.chunks = out
    this.x = Math.min(this.x, w)
    this.zones = this.zones.filter((z) => z.x0 < w).map((z) => ({ ...z, x1: Math.min(z.x1, w) }))
    return this
  }
}

/** Insert `by` blank cells into a line at cell position `from`, keeping buttons clickable. */
export function shiftLine(l: Line, by: number, from: number): Line {
  const out = new Line()
  out.rule = l.rule
  let x = 0
  let done = false
  for (const c of l.chunks) {
    if (!done && x + c.text.length > from) {
      const cut = from - x
      if (cut > 0) out.chunks.push({ ...c, text: c.text.slice(0, cut) })
      out.chunks.push({ ...chunk(" ".repeat(by)), bg: c.bg })
      const rest = c.text.slice(cut)
      if (rest) out.chunks.push({ ...c, text: rest })
      done = true
    } else out.chunks.push(c)
    x += c.text.length
  }
  if (!done) out.chunks.push(chunk(" ".repeat(by)))
  out.x = l.x + by
  out.zones = l.zones.map((z) => (z.x0 >= from ? { ...z, x0: z.x0 + by, x1: z.x1 + by } : z.x1 > from ? { ...z, x1: z.x1 + by } : z))
  return out
}

export function toContent(lines: Line[]): StyledText {
  const out: TextChunk[] = []
  lines.forEach((l, i) => {
    out.push(...l.chunks)
    if (i < lines.length - 1) out.push(chunk("\n"))
  })
  return new StyledText(out)
}

/** Pad a column to the full body height so the "│" divider never breaks. */
export const pad = (lines: Line[], B: number, ow: number, divider = true, extra = 0, edgeBg?: (y: number) => string | undefined): Line[] => {
  const out = lines.slice(0, B).map((l, y) => {
    if (l.rule) {
      // rules run edge to edge so they touch the dividers; keep their joints (┬ ┼ ┴), extend with ─
      const text = l.chunks.map((c) => c.text).join("")
      const r = new Line().add(text.slice(0, ow) + "─".repeat(Math.max(0, ow - text.length)), C.sep)
      r.rule = true
      // a selection on the left of this rule row: half-cell highlight ending at the divider line, like every other row
      const ebg = divider ? edgeBg?.(y) : undefined
      if (ebg && r.chunks[0]) {
        const rest = r.chunks[0].text.slice(1)
        r.chunks = [chunk("▌", ebg), ...(rest ? [{ ...r.chunks[0], text: rest }] : [])]
      }
      return r
    }
    const r = (extra > 0 ? shiftLine(l, extra, divider ? 1 : 0) : l).clip(ow).padRight(ow)
    // the divider cell is half-filled with the colour of a selection on its left, so the highlight touches the line
    const bg = divider ? edgeBg?.(y) : undefined
    if (bg && r.chunks[0]) {
      const first = r.chunks[0]
      // half a cell, so the highlight ends exactly at the line
      r.chunks[0] = chunk("▌", bg)
      // this row's own highlight begins at the same divider (its "▐"): paint that colour on the right half
      if (first.text === "▐") r.chunks[0] = { ...r.chunks[0]!, bg: first.fg }
    }
    return r
  })
  while (out.length < B) out.push((divider ? new Line().add("│", C.sep) : new Line()).fill(ow))
  return out
}
