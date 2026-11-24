// A text-mode picture of an app's icon, drawn with quadrant block characters (2 x 2 "pixels" per cell).
// The picture is made lazily and in the background (only for the app being shown), cached in memory and on
// disk, so drawing never waits for it. While it is not ready, and for anything that is not an .app, a grey
// tile with an "i" is shown instead.
import { execFile } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { inflateSync } from "node:zlib"
import { Line } from "./line"
import { C, KEEP } from "./theme"
import { app } from "../ui/hooks"

export const ICON_COLS = 10 // the one number that sets the icon size (and its detail): use an even number
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
const CACHE_FILE = join(DIR, "icons-v4.json")
/** W*H colours ("#rrggbb", or "" for see-through), or null when the app has no usable icon. */
type Grid = string[] | null
const grids = new Map<string, Grid>()
const pending = new Set<string>()
const queue: string[] = []
let running = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined

const keep = (g: Grid) => g?.forEach((c) => c && KEEP.add(c))
try {
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, Grid>)) (grids.set(k, v), keep(v))
} catch {}

/** The outermost .app folder of a command line, or undefined for plain programs. */
export const bundleOf = (command: string): string | undefined => command.match(/^(\/.*?\.app)\//)?.[1]

// Drawing an icon means picking the best block character for every cell, so each picture is drawn once and reused.
const drawn = new Map<string, Line[]>()
const once = (key: string, make: () => Line[]) => drawn.get(key) ?? (drawn.set(key, make()), drawn.get(key)!)

/** The icon as ICON_ROWS lines, each ICON_COLS wide. Never blocks, and costs almost nothing once drawn. */
export function iconRows(command: string): Line[] {
  const b = bundleOf(command)
  if (!b) return once("mark", () => tile(true))
  const g = grids.get(b)
  if (g === undefined) {
    if (!pending.has(b)) (pending.add(b), queue.push(b), pump())
    return once("blank", () => tile(false))
  }
  return g ? once(b, () => draw(g)) : once("mark", () => tile(true))
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
    return dot || stem ? "#8b949e" : C.barBg
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
        l.add(QUAD[solid.reduce((m, k) => m | (1 << k), 0)]!, hex(mean(solid.map((k) => cols[k]!))))
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
    const b = queue.shift()!
    running++
    compute(b)
      .catch(() => null)
      .then((g) => {
        grids.set(b, g)
        keep(g)
        pending.delete(b)
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

async function compute(bundle: string): Promise<Grid> {
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

/** Decode an 8-bit RGB/RGBA PNG, crop away its see-through margin and shrink it to N x N colours. */
function toGrid(png: Buffer): Grid {
  let w = 0
  let h = 0
  let type = 0
  const idat: Buffer[] = []
  for (let o = 8; o + 8 <= png.length; ) {
    const len = png.readUInt32BE(o)
    const kind = png.toString("ascii", o + 4, o + 8)
    if (kind === "IHDR") {
      w = png.readUInt32BE(o + 8)
      h = png.readUInt32BE(o + 12)
      if (png[o + 16] !== 8 || png[o + 20] !== 0) return null // only 8-bit, non-interlaced
      type = png[o + 17]!
    } else if (kind === "IDAT") idat.push(png.subarray(o + 8, o + 8 + len))
    o += 12 + len
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0
  if (!bpp || !w || !h) return null
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const px = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!
    const src = y * (stride + 1) + 1
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[y * stride + i - bpp]! : 0
      const b = y ? px[(y - 1) * stride + i]! : 0
      const c = y && i >= bpp ? px[(y - 1) * stride + i - bpp]! : 0
      let v = raw[src + i]!
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[y * stride + i] = v & 255
    }
  }
  const alphaAt = (x: number, y: number) => (bpp === 4 ? px[y * stride + x * 4 + 3]! : 255)
  // the box that holds the visible part of the icon, made square
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alphaAt(x, y) <= 128) continue
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
  }
  if (x1 < 0) return null
  const side = Math.max(x1 - x0, y1 - y0) + 1
  const sx = x0 - Math.floor((side - (x1 - x0 + 1)) / 2)
  const sy = y0 - Math.floor((side - (y1 - y0 + 1)) / 2)
  const hx = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")
  const out: string[] = []
  for (let gy = 0; gy < H; gy++) {
    const ya = Math.floor(sy + (gy * side) / H)
    const yb = Math.max(ya + 1, Math.floor(sy + ((gy + 1) * side) / H))
    for (let gx = 0; gx < W; gx++) {
      const xa = Math.floor(sx + (gx * side) / W)
      const xb = Math.max(xa + 1, Math.floor(sx + ((gx + 1) * side) / W))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let y = ya; y < yb; y++) {
        for (let x = xa; x < xb; x++) {
          n++
          if (x < 0 || y < 0 || x >= w || y >= h) continue
          const al = alphaAt(x, y)
          const i = y * stride + x * bpp
          r += px[i]! * al
          g += px[i + 1]! * al
          b += px[i + 2]! * al
          a += al
        }
      }
      out.push(a / n < 128 ? "" : `#${hx(r / a)}${hx(g / a)}${hx(b / a)}`)
    }
  }
  return out
}
