// A text-mode picture of an app's icon, drawn with quadrant block characters (2 x 2 "pixels" per cell).
// The picture is made lazily and in the background (only for the app being shown), cached in memory and on
// disk, so drawing never waits for it. Icons come from a macOS .app bundle or, on Linux, from the icon
// theme the app's .desktop launcher points at. While it is not ready, and for anything without an icon,
// a grey tile with an "i" is shown instead.
import { execFile } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { findIconFile, linuxApp } from "../data/apps"
import { Line } from "./line"
import { pngToGrid } from "./png"
import { C, KEEP } from "./theme"
import { app } from "../ui/hooks"

export const ICON_COLS = 14 // the one number that sets the icon size (and its detail): use an even number
export const ICON_ROWS = ICON_COLS / 2 // a cell is about twice as tall as it is wide, so the icon comes out square
const C0 = ICON_COLS // the icon's side, in columns
const W = 2 * ICON_COLS // sub-pixels across (2 per cell)
const H = 2 * ICON_ROWS // sub-pixels down (2 per cell)
const MARK_SCALE = 0.6 // how much of the tile the "i" fills (1 = edge to edge)
export const ICON_RADIUS = 0.3 // corner roundness as a fraction of the icon's side (0 = square)

/** Is the point (x, y), measured in columns from the icon's top-left corner, inside its rounded square? */
function inside(x: number, y: number): boolean {
  const R = C0 * ICON_RADIUS
  const cx = Math.min(Math.max(x, R), C0 - R)
  const cy = Math.min(Math.max(y, R), C0 - R)
  return Math.hypot(x - cx, y - cy) <= R
}
// sub-pixel (sx, sy) sits at ((sx + 0.5) / 2, (sy + 0.5)) columns: half a column wide, one column tall
const centerX = (sx: number) => (sx + 0.5) / 2
const centerY = (sy: number) => sy + 0.5

const DIR = join(homedir(), ".cache", "uitop")
const CACHE_FILE = join(DIR, "icons-v8.json")
/** W*H colours ("#rrggbb", or "" for see-through), or null when the app has no usable icon. */
type Grid = string[] | null
/** Where an icon comes from: a macOS .app bundle, or an icon name to look up on Linux. */
type Source = { key: string; kind: "mac" | "name"; path: string; command?: string }
const grids = new Map<string, Grid>()
const pending = new Set<string>()
const queue: Source[] = []
let running = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined

const keep = (g: Grid) => g?.forEach((c) => c && KEEP.add(c))
try {
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, Grid>)) (grids.set(k, v), keep(v))
} catch {}

/** The outermost .app folder of a command line, or undefined for plain programs. */
export const bundleOf = (command: string): string | undefined => command.match(/^(\/.*?\.app)\//)?.[1]

/** Which icon file (or bundle) stands for this command, if any. */
function sourceOf(command: string, icon?: string): Source | undefined {
  if (process.platform === "darwin") {
    const b = bundleOf(command)
    if (b && existsSync(join(b, "Contents", "Info.plist"))) return { key: `mac:${b}`, kind: "mac", path: b }
    return
  }
  if (process.platform === "linux") {
    const name = icon ?? linuxApp(command)?.icon
    // look the name up off the drawing path, in compute()
    if (name) return { key: `icon:${name}`, kind: "name", path: name, command }
  }
  return
}

// Drawing an icon means picking the best block character for every cell, so each picture is drawn once and reused.
const drawn = new Map<string, Line[]>()
const once = (key: string, make: () => Line[]) => drawn.get(key) ?? (drawn.set(key, make()), drawn.get(key)!)

/** The icon as ICON_ROWS lines, each ICON_COLS wide. Never blocks, and costs almost nothing once drawn. */
export function iconRows(command: string, icon?: string): Line[] {
  const src = sourceOf(command, icon)
  if (!src) return once("mark", () => tile(true))
  const g = grids.get(src.key)
  if (g === undefined) {
    if (!pending.has(src.key)) (pending.add(src.key), queue.push(src), pump())
    return once("blank", () => tile(false))
  }
  return g ? once(src.key, () => draw(g)) : once("mark", () => tile(true))
}

/** A rounded grey tile; with an "i" (for info) when it stands for "no app icon". */
function tile(mark: boolean): Line[] {
  const U = C0 * MARK_SCALE // the mark's own size, so it leaves an empty margin inside the tile
  const g = Array.from({ length: W * H }, (_, i) => {
    if (!mark) return C.barBg
    const nx = (centerX(i % W) - C0 / 2) / U // -0.5 .. 0.5 across the mark
    const ny = (centerY(Math.floor(i / W)) - C0 / 2) / U
    const dot = Math.hypot(nx, ny + 0.4) <= 0.12
    const stem = Math.abs(nx) <= 0.1 && ny >= -0.1 && ny <= 0.5
    return dot || stem ? C.icon : C.barBg
  })
  g.forEach((col) => col && KEEP.add(col))
  return draw(g)
}

// the character for each way of filling a cell's four quadrants (bit 1 top-left, 2 top-right, 4 bottom-left, 8 bottom-right)
const QUAD = " ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█"

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hex = (c: number[]) => "#" + c.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join("")
const mean = (cs: number[][]) => [0, 1, 2].map((k) => cs.reduce((a, c) => a + c[k]!, 0) / cs.length)

function draw(g: string[]): Line[] {
  const rows: Line[] = []
  for (let r = 0; r < ICON_ROWS; r++) {
    const l = new Line()
    for (let c = 0; c < ICON_COLS; c++) {
      // the four quadrants of this cell: top-left, top-right, bottom-left, bottom-right
      const q = [0, 1, 2, 3].map((k) => {
        const sx = 2 * c + (k & 1)
        const sy = 2 * r + (k >> 1)
        return inside(centerX(sx), centerY(sy)) ? g[sy * W + sx] || "" : ""
      })
      const solid = [0, 1, 2, 3].filter((k) => q[k])
      if (!solid.length) {
        l.add(" ")
        continue
      }
      const cols = q.map((x) => (x ? rgb(x) : [0, 0, 0]))
      if (solid.length < 4) {
        // see-through corners: only the opaque quadrants are drawn, over the terminal background
        const part = hex(mean(solid.map((k) => cols[k]!)))
        KEEP.add(part) // without this, mono mode paints the corner cells white
        l.add(QUAD[solid.reduce((m, k) => m | (1 << k), 0)]!, part)
        continue
      }
      // all four are opaque: pick the two-colour split (foreground / background) that loses the least detail
      const all = mean(cols) // a plain block of one colour is the starting point to beat
      let best = { err: cols.reduce((e, x) => e + (x[0]! - all[0]!) ** 2 + (x[1]! - all[1]!) ** 2 + (x[2]! - all[2]!) ** 2, 0), mask: 15, fg: all, bg: all }
      for (let mask = 1; mask < 15; mask++) {
        const a = [0, 1, 2, 3].filter((k) => mask & (1 << k)).map((k) => cols[k]!)
        const b = [0, 1, 2, 3].filter((k) => !(mask & (1 << k))).map((k) => cols[k]!)
        const ma = mean(a)
        const mb = mean(b)
        let err = 0
        for (const x of a) for (let k = 0; k < 3; k++) err += (x[k]! - ma[k]!) ** 2
        for (const x of b) for (let k = 0; k < 3; k++) err += (x[k]! - mb[k]!) ** 2
        if (err < best.err) best = { err, mask, fg: ma, bg: mb }
      }
      const fgHex = hex(best.fg)
      const bgHex = hex(best.bg)
      KEEP.add(fgHex)
      KEEP.add(bgHex)
      l.add(QUAD[best.mask]!, fgHex, { bg: bgHex })
    }
    rows.push(l)
  }
  return rows
}

function pump(): void {
  while (running < 3 && queue.length) {
    const src = queue.shift()!
    running++
    compute(src)
      .catch(() => null)
      .then((g) => {
        grids.set(src.key, g)
        keep(g)
        pending.delete(src.key)
        running--
        scheduleSave()
        app.render()
        pump()
      })
  }
}

function scheduleSave(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      mkdirSync(DIR, { recursive: true })
      writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(grids)))
    } catch {}
  }, 1000)
}

const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, { timeout: 5000 }, (e, out) => (e ? rej(e) : res(String(out).trim()))))

async function compute(src: Source): Promise<Grid> {
  if (src.kind === "mac") return computeMac(src.path)
  // Resolving an icon name means scanning the icon themes. Let the frame that asked for the tile
  // finish first, so that scanning runs in the background like the rest of the icon work.
  await new Promise((r) => setTimeout(r, 0))
  let file = findIconFile(src.path)
  if (!file && src.command) {
    const alt = linuxApp(src.command)?.icon
    file = alt ? findIconFile(alt) : undefined
  }
  return file ? computeFile(file) : null
}

/** macOS: ask the bundle's Info.plist for its .icns and convert that to a PNG. */
async function computeMac(bundle: string): Promise<Grid> {
  const plist = join(bundle, "Contents", "Info.plist")
  if (!existsSync(plist)) return null
  let name = await run("plutil", ["-extract", "CFBundleIconFile", "raw", "-o", "-", plist]).catch(() => "")
  if (!name) name = await run("plutil", ["-extract", "CFBundleIconName", "raw", "-o", "-", plist]).catch(() => "")
  if (!name) return null
  if (!/\.icns$/i.test(name)) name += ".icns"
  const icns = join(bundle, "Contents", "Resources", name)
  if (!existsSync(icns)) return null
  const png = join(tmpdir(), `uitop-icon-${process.pid}-${Math.random().toString(36).slice(2)}.png`)
  await run("sips", ["-s", "format", "png", "-z", "160", "160", icns, "--out", png])
  const buf = readFileSync(png)
  try {
    unlinkSync(png)
  } catch {}
  return toGrid(buf)
}

/** Linux: a theme's PNG is ready to use; an SVG first has to be rendered by whatever is installed. */
async function computeFile(file: string): Promise<Grid> {
  let png = file
  let temp = false
  if (/\.svg$/i.test(file)) {
    const made = await rasterize(file)
    if (!made) return null
    png = made
    temp = true
  } else if (!/\.png$/i.test(file)) return null
  try {
    return toGrid(readFileSync(png))
  } finally {
    if (temp) {
      try {
        unlinkSync(png)
      } catch {}
    }
  }
}

async function rasterize(svg: string): Promise<string | undefined> {
  const out = join(tmpdir(), `uitop-icon-${process.pid}-${Math.random().toString(36).slice(2)}.png`)
  const attempts: [string, string[]][] = [
    ["rsvg-convert", ["-w", "160", "-h", "160", "-o", out, svg]],
    ["inkscape", [svg, "--export-type=png", `--export-filename=${out}`, "-w", "160", "-h", "160"]],
    // PNG32: force 8-bit RGBA; without it ImageMagick writes 16-bit grey for monochrome icons
    ["convert", ["-background", "none", "-density", "600", svg, "-resize", "160x160", `PNG32:${out}`]],
  ]
  for (const [cmd, args] of attempts) {
    try {
      await run(cmd, args)
      if (existsSync(out)) return out
    } catch {}
  }
  return undefined
}

const toGrid = (png: Buffer): Grid => pngToGrid(png, W, H)
