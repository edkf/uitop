// Number and duration formatting.


export const fmtMem = (kib: number) =>
  kib >= 1048576 ? `${(kib / 1048576).toFixed(1)} GB` : kib >= 1024 ? `${Math.round(kib / 1024)} MB` : `${kib} KB`

export const fmtDur = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : `${Math.round(sec)}s`)

export function fmtBytes(b: number): string {
  const g = b / 2 ** 30
  return g >= 1 ? `${g.toFixed(2)}G` : `${(b / 2 ** 20).toFixed(0)}M`
}

export function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const hms = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
  return d > 0 ? `${d} day${d > 1 ? "s" : ""}, ${hms}` : hms
}
