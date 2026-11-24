// The numbers the Overview shows, computed once per draw.
import type { CpuInfo } from "node:os"
import os from "node:os"
import { C } from "../../lib/theme"
import { state } from "../../state"

/** A plain word and a colour for a percentage. */
export type Level = [word: string, color: string]
export const level = (pct: number, words: [string, string, string, string], cuts: [number, number, number]): Level =>
  pct < cuts[0] ? [words[0], C.green] : pct < cuts[1] ? [words[1], C.green] : pct < cuts[2] ? [words[2], C.yellow] : [words[3], C.memRed]

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
    cpu: level(cpuPct, ["Relaxed", "Working", "Busy", "Maxed out"], [30, 60, 85]),
    memory: level(memPct, ["Plenty free", "Plenty free", "Getting full", "Almost full"], [50, 70, 85]),
    disk: level(diskPct, ["Plenty of space", "Plenty of space", "Getting full", "Almost full"], [50, 75, 90]),
  }
}
