// Colours, the text-chunk helper and the padding rules.
import { RGBA, type TextChunk } from "@opentui/core"

export const C = {
  fg: "#c9d1d9",
  dim: "#6e7681",
  green: "#3fb950",
  yellow: "#d29922",
  memRed: "#f85149", // the only text colour besides white: high memory use
  blue: "#58a6ff",
  cyan: "#39c5cf",
  headerBg: "#1f6feb",
  selBg: "#264f78",
  inactiveSel: "#2d333b",
  btnBg: "#30363d",
  barBg: "#30363d",
  sep: "#30363d",
  faint: "#6e7681", // the chevron of a sort heading that is not the active one
}
export const rgba = new Map<string, RGBA>()
export const col = (h: string) => rgba.get(h) ?? (rgba.set(h, RGBA.fromHex(h)), rgba.get(h)!)
export interface Style {
  bg?: string
}
export const KEEP = new Set([C.memRed, C.barBg, C.sep, C.faint, C.selBg, C.inactiveSel])
export const mode = { mono: true } // lists and surrounding UI: white text (+ red for high memory). The Overview turns this off to use full colour.
export const chunk = (text: string, fg = C.fg, o: Style = {}): TextChunk => ({
  __isChunk: true,
  text,
  fg: col(mode.mono && !KEEP.has(fg) ? "#ffffff" : fg),
  bg: o.bg ? col(o.bg) : undefined,
})
export const pctColor = (p: number) => (mode.mono ? C.fg : p >= 80 ? C.memRed : p >= 50 ? C.yellow : C.green)
export const memColor = (kib: number) => (kib > 1048576 ? C.memRed : mode.mono ? C.fg : kib > 524288 ? C.yellow : C.fg)

// Padding. A terminal cell is about twice as tall as it is wide, so 2 columns look as big as 1 row.
// Using PADX = 2 * PADY makes the space around content look equal on all sides.
// Sort indicators. Small triangles: centred on the text line and always one column wide.
export const SORT_DESC = "▾"
export const SORT_ASC = "▴"
export const SELECTED = "▸" // marks the selected page in the sidebar (the right-pointing twin of the sort indicator ▾)
export const COLGAP = 3 // blank columns between the CPU and Memory columns
export const PADY = 1 // rows
export const PADX = 2 * PADY // columns
