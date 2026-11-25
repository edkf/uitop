// Colours, the text-chunk helper and the padding rules.
import { RGBA, type TextChunk } from "@opentui/core"

const DARK = {
  fg: "#c9d1d9",
  dim: "#6e7681",
  green: "#3fb950",
  yellow: "#d29922",
  memYellow: "#d29921", // medium memory use in the lists; a distinct hex so it is the only yellow kept in mono mode
  memRed: "#f85149", // the only text colour besides the strong text: high memory use
  blue: "#58a6ff",
  cyan: "#39c5cf",
  text: "#ffffff", // strong text: white on a dark terminal
  selBg: "#ffffff", // focused selection: a solid block with contrasting text
  selFg: "#0d1117", // text on the focused selection (the terminal background)
  inactiveSel: "#2d333b",
  btnBg: "#30363d",
  barBg: "#30363d",
  sep: "#30363d",
  faint: "#6e7681", // the chevron of a sort heading that is not the active one
  modalBg: "#161b22",
  icon: "#8b949e",
}
const LIGHT: typeof DARK = {
  fg: "#24292f",
  dim: "#6e7781",
  green: "#1a7f37",
  yellow: "#9a6700",
  memYellow: "#9a6701",
  memRed: "#cf222e",
  blue: "#0969da",
  cyan: "#1b7c83",
  text: "#1f2328", // strong text: near-black on a light terminal
  selBg: "#1f2328",
  selFg: "#ffffff",
  inactiveSel: "#d0d7de",
  btnBg: "#d0d7de",
  barBg: "#d8dee4",
  sep: "#d0d7de",
  faint: "#8c959f",
  modalBg: "#f6f8fa",
  icon: "#6e7781",
}
export const C: typeof DARK = { ...DARK }
export const theme = { light: false }
const listeners: (() => void)[] = []
/** Run `fn` whenever the palette changes (for things that hold a colour themselves, like the modal boxes). */
export const onTheme = (fn: () => void) => listeners.push(fn)
export const setTheme = (mode: "dark" | "light") => {
  theme.light = mode === "light"
  Object.assign(C, theme.light ? LIGHT : DARK)
  for (const fn of listeners) fn()
}
/** Best guess before the terminal answers: COLORFGBG ("fg;bg", bg 7 or 15 means light). */
export const guessTheme = (): "dark" | "light" => {
  const bg = Number((process.env.COLORFGBG ?? "").split(";").pop())
  return bg === 7 || bg === 15 ? "light" : "dark"
}
export const rgba = new Map<string, RGBA>()
export const col = (h: string) => rgba.get(h) ?? (rgba.set(h, RGBA.fromHex(h)), rgba.get(h)!)
export interface Style {
  bg?: string
}
const keeps = () => [C.selFg, C.memRed, C.memYellow, C.barBg, C.sep, C.faint, C.selBg, C.inactiveSel]
const extra = new Set<string>() // colours the app icons add so they survive mono mode
export const KEEP = { has: (h: string) => extra.has(h) || keeps().includes(h), add: (h: string) => void extra.add(h) }
export const mode = { mono: true } // lists and surrounding UI: white text (+ red for high memory). The Overview turns this off to use full colour.
export const chunk = (text: string, fg = C.fg, o: Style = {}): TextChunk => ({
  __isChunk: true,
  text,
  fg: col(mode.mono && !KEEP.has(fg) ? C.text : fg),
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
export const btnColors = (focused: boolean): [fg: string, bg: string] => (focused ? [C.selFg, C.selBg] : [C.text, C.btnBg])
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
