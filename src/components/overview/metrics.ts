// The numbers the Overview shows, computed once per draw.
import type { CpuInfo } from "node:os"
import os from "node:os"
import { type Gauge, LIMITS, levelColor } from "../../lib/theme"
import { state } from "../../state"

/** A plain word and a colour for a percentage. */
export type Level = [word: string, color: string]
export const level = (pct: number, gauge: Gauge, words: [string, string, string, string]): Level => {
  const l = LIMITS[gauge]
  return [words[pct < l[0] ? 0 : pct < l[1] ? 1 : pct < l[2] ? 2 : 3], levelColor(gauge, pct)]
}

export interface Metrics {
  cpuPct: number
  memPct: number
  swapPct: number
  diskPct: number
  loadPct: number
  load: number[]
  cpus: CpuInfo[]
  cpu: Level
  memory: Level
  disk: Level
}

export function getMetrics(): Metrics {
  const cores = Math.max(1, state.cpu.length)
  const cpuPct = state.cpu.reduce((a, b) => a + b, 0) / cores
  const m = state.mem
  const memPct = (m.used / m.total) * 100
  const swapPct = m.swapTotal ? (m.swapUsed / m.swapTotal) * 100 : 0
  const diskPct = (state.disk.used / state.disk.total) * 100
  const load = os.loadavg()
  return {
    cpuPct,
    memPct,
    swapPct,
    diskPct,
    load,
    loadPct: (load[0]! / cores) * 100,
    cpus: os.cpus(),
    cpu: level(cpuPct, "cpu", ["Relaxed", "Working", "Busy", "Maxed out"]),
    memory: level(memPct, "mem", ["Plenty free", "Plenty free", "Getting full", "Almost full"]),
    disk: level(diskPct, "disk", ["Plenty of space", "Plenty of space", "Getting full", "Almost full"]),
  }
}
