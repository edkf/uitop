// Colours, the text-chunk helper and the padding rules.
import { RGBA, type TextChunk } from "@opentui/core"

export const C = {
  fg: "#c9d1d9",
  dim: "#6e7681",
  green: "#3fb950",
  yellow: "#d29922",
  memYellow: "#d29921", // medium memory use in the lists; a distinct hex so it is the only yellow kept in mono mode
  memRed: "#f85149", // the only text colour besides white: high memory use
  blue: "#58a6ff",
  cyan: "#39c5cf",
  selBg: "#ffffff", // focused selection: white block with dark text
  selFg: "#0d1117", // text on the focused selection (the terminal background)
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
export const KEEP = new Set([C.selFg, C.memRed, C.memYellow, C.barBg, C.sep, C.faint, C.selBg, C.inactiveSel])
export const mode = { mono: true } // lists and surrounding UI: white text (+ red for high memory). The Overview turns this off to use full colour.
export const chunk = (text: string, fg = C.fg, o: Style = {}): TextChunk => ({
  __isChunk: true,
  text,
  fg: col(mode.mono && !KEEP.has(fg) ? "#ffffff" : fg),
  bg: o.bg ? col(o.bg) : undefined,
})
// ONE place for "how full is it". Every gauge, chart, meter and word asks here, so the colour for a given
// number is the same on every screen. Change a limit here and everything follows.
// Each entry is [fine below, fine below, getting full below]; from the last number up it is red.
export type Limits = [number, number, number]
export const LIMITS = {
  cpu: [30, 60, 85],
  mem: [50, 70, 85],
  swap: [25, 25, 50],
  disk: [50, 75, 90],
  load: [40, 70, 110],
} as const satisfies Record<string, Limits>
export type Gauge = keyof typeof LIMITS
export const levelColor = (gauge: Gauge, pct: number): string => {
  const l = LIMITS[gauge]
  return pct < l[1] ? C.green : pct < l[2] ? C.yellow : C.memRed
}
/** Text and background colours for a button: the focused one is always the white block with dark text, everywhere. */
export const btnColors = (focused: boolean): [fg: string, bg: string] => (focused ? [C.selFg, C.selBg] : ["#ffffff", C.btnBg])
/** Colour for one item's own percentage (a single process or core), not a whole-machine gauge. */
export const pctColor = (p: number) => (mode.mono ? C.fg : p >= 80 ? C.memRed : p >= 50 ? C.yellow : C.green)
export const memColor = (kib: number) => (kib > 1048576 ? C.memRed : kib > 524288 ? C.memYellow : C.fg)

// Padding. A terminal cell is about twice as tall as it is wide, so 2 columns look as big as 1 row.
// Using PADX = 2 * PADY makes the space around content look equal on all sides.
// Sort indicators. Small triangles: centred on the text line and always one column wide.
export const SORT_DESC = "▾"
export const SORT_ASC = "▴"
export const SELECTED = "▸" // marks the selected page in the sidebar (the right-pointing twin of the sort indicator ▾)
export const COLGAP = 3 // blank columns between the CPU and Memory columns
export const PADY = 1 // rows
export const PADX = 2 * PADY // columns
