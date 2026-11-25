// Minimal PNG decoder for app icons: 8/16-bit RGB, RGBA, grey and palette images, non-interlaced.
// It crops the see-through margin, squares the picture and shrinks it to a small grid of colours.
import { inflateSync } from "node:zlib"

/** outW x outH colours ("#rrggbb", or "" for see-through), or null when the PNG cannot be used. */
export function pngToGrid(png: Buffer, outW: number, outH: number): string[] | null {
  let w = 0
  let h = 0
  let depth = 0
  let type = 0
  let palette: Buffer | undefined
  let trns: Buffer | undefined
  const idat: Buffer[] = []
  for (let o = 8; o + 8 <= png.length; ) {
    const len = png.readUInt32BE(o)
    const kind = png.toString("ascii", o + 4, o + 8)
    if (kind === "IHDR") {
      w = png.readUInt32BE(o + 8)
      h = png.readUInt32BE(o + 12)
      depth = png[o + 16]!
      type = png[o + 17]!
      if (png[o + 20] !== 0) return null // interlaced
    } else if (kind === "PLTE") palette = png.subarray(o + 8, o + 8 + len)
    else if (kind === "tRNS") trns = png.subarray(o + 8, o + 8 + len)
    else if (kind === "IDAT") idat.push(png.subarray(o + 8, o + 8 + len))
    o += 12 + len
  }
  const channels = type === 6 ? 4 : type === 2 ? 3 : type === 3 ? 1 : type === 4 ? 2 : type === 0 ? 1 : 0
  if (!channels || !w || !h || (depth !== 8 && depth !== 16)) return null
  if (type === 3 && (depth !== 8 || !palette)) return null
  const bytes = depth === 16 ? 2 : 1
  const srcBpp = channels * bytes
  const raw = inflateSync(Buffer.concat(idat))
  const srcStride = w * srcBpp
  const src = Buffer.alloc(srcStride * h)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (srcStride + 1)]!
    const start = y * (srcStride + 1) + 1
    for (let i = 0; i < srcStride; i++) {
      const a = i >= srcBpp ? src[y * srcStride + i - srcBpp]! : 0
      const b = y ? src[(y - 1) * srcStride + i]! : 0
      const c = y && i >= srcBpp ? src[(y - 1) * srcStride + i - srcBpp]! : 0
      let v = raw[start + i]!
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
      src[y * srcStride + i] = v & 255
    }
  }
  // palette and RGB images are expanded to RGBA, so the rest of the function has one format to handle
  const bpp = 4
  const stride = w * bpp
  const px = Buffer.alloc(stride * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    if (type === 3) {
      const k = src[i]!
      px[o] = palette![k * 3] ?? 0
      px[o + 1] = palette![k * 3 + 1] ?? 0
      px[o + 2] = palette![k * 3 + 2] ?? 0
      px[o + 3] = trns?.[k] ?? 255
    } else {
      const s = i * srcBpp
      // for 16-bit channels the first byte is the high byte, which is all the 20x10 icon needs
      if (type === 0 || type === 4) {
        px[o] = src[s]!
        px[o + 1] = src[s]!
        px[o + 2] = src[s]!
        px[o + 3] = channels === 2 ? src[s + bytes]! : 255
      } else {
        px[o] = src[s]!
        px[o + 1] = src[s + bytes]!
        px[o + 2] = src[s + 2 * bytes]!
        px[o + 3] = channels === 4 ? src[s + 3 * bytes]! : 255
      }
    }
  }
  const alphaAt = (x: number, y: number) => px[y * stride + x * 4 + 3]!
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
  for (let gy = 0; gy < outH; gy++) {
    const ya = Math.floor(sy + (gy * side) / outH)
    const yb = Math.max(ya + 1, Math.floor(sy + ((gy + 1) * side) / outH))
    for (let gx = 0; gx < outW; gx++) {
      const xa = Math.floor(sx + (gx * side) / outW)
      const xb = Math.max(xa + 1, Math.floor(sx + ((gx + 1) * side) / outW))
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
