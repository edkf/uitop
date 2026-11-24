// System data collection: CPU, memory, swap, processes. Works on macOS and Linux.
import os from "node:os"
import { readFileSync } from "node:fs"

export interface Proc {
  pid: number
  ppid: number
  user: string
  ni: number
  vsz: number // KiB
  rss: number // KiB
  stat: string
  cpu: number // %
  mem: number // %
  time: string
  command: string
}

export interface MemInfo {
  total: number // bytes
  used: number
  swapTotal: number
  swapUsed: number
}

const run = async (cmd: string[]): Promise<string> => {
  const p = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" })
  const out = await new Response(p.stdout).text()
  await p.exited
  return out
}

// ---- CPU ----------------------------------------------------------------
let prevTimes = os.cpus().map((c) => c.times)

/** Per-core busy percentage since the previous call. */
export function sampleCpu(): number[] {
  const cur = os.cpus().map((c) => c.times)
  const res = cur.map((t, i) => {
    const p = prevTimes[i] ?? t
    const busy = t.user - p.user + (t.nice - p.nice) + (t.sys - p.sys) + (t.irq - p.irq)
    const total = busy + (t.idle - p.idle)
    return total > 0 ? (busy / total) * 100 : 0
  })
  prevTimes = cur
  return res
}

// ---- Memory -------------------------------------------------------------
export async function sampleMem(): Promise<MemInfo> {
  const total = os.totalmem()
  let used = total - os.freemem()
  let swapTotal = 0
  let swapUsed = 0
  try {
    if (process.platform === "linux") {
      const m = Object.fromEntries(
        readFileSync("/proc/meminfo", "utf8")
          .split("\n")
          .map((l) => l.match(/^(\w+):\s+(\d+)/))
          .filter(Boolean)
          .map((x) => [x![1], Number(x![2]) * 1024]),
      ) as Record<string, number>
      used = m.MemTotal - (m.MemAvailable ?? m.MemFree)
      swapTotal = m.SwapTotal ?? 0
      swapUsed = swapTotal - (m.SwapFree ?? 0)
    } else if (process.platform === "darwin") {
      const [vm, sw] = await Promise.all([run(["vm_stat"]), run(["sysctl", "-n", "vm.swapusage"])])
      const page = Number(vm.match(/page size of (\d+)/)?.[1] ?? 16384)
      const get = (k: string) => Number(vm.match(new RegExp(`${k}:\\s+(\\d+)`))?.[1] ?? 0)
      // "Memory used" = app (anonymous) + wired + compressed memory
      const anon = get("Anonymous pages")
      const wired = get("Pages wired down")
      const comp = get("Pages occupied by compressor")
      if (anon + wired + comp > 0) used = (anon + wired + comp) * page
      const toBytes = (s?: string) => {
        if (!s) return 0
        const n = parseFloat(s)
        return n * ({ K: 1 << 10, M: 1 << 20, G: 1 << 30 } as Record<string, number>)[s.slice(-1)]!
      }
      swapTotal = toBytes(sw.match(/total = (\S+)/)?.[1])
      swapUsed = toBytes(sw.match(/used = (\S+)/)?.[1])
    }
  } catch {}
  return { total, used: Math.min(used, total), swapTotal, swapUsed }
}

// ---- Disk ---------------------------------------------------------------
export interface DiskInfo {
  total: number // bytes
  used: number
}
export async function sampleDisk(): Promise<DiskInfo> {
  // On macOS the user's data lives on its own volume; "/" alone is just the sealed system volume.
  for (const path of process.platform === "darwin" ? ["/System/Volumes/Data", "/"] : ["/"]) {
    try {
      const row = (await run(["df", "-Pk", path])).trim().split("\n")[1]?.split(/\s+/)
      if (row && row.length >= 4) {
        const total = Number(row[1]) * 1024
        const avail = Number(row[3]) * 1024
        if (total > 0) return { total, used: total - avail }
      }
    } catch {}
  }
  return { total: 1, used: 0 }
}

// ---- Processes ----------------------------------------------------------
export async function sampleProcs(): Promise<Proc[]> {
  const out = await run(["ps", "-axo", "pid=,ppid=,user=,nice=,vsz=,rss=,stat=,pcpu=,pmem=,time=,command="])
  const procs: Proc[] = []
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.*)$/)
    if (!m) continue
    procs.push({
      pid: +m[1]!,
      ppid: +m[2]!,
      user: m[3]!,
      ni: +m[4]!,
      vsz: +m[5]!,
      rss: +m[6]!,
      stat: m[7]!,
      cpu: +m[8]!,
      mem: +m[9]!,
      time: m[10]!,
      command: m[11]!,
    })
  }
  return procs
}

// ---- Static machine info ----------------------------------------------------
export async function sampleOsName(): Promise<string> {
  try {
    if (process.platform === "darwin") {
      const [n, v] = await Promise.all([run(["sw_vers", "-productName"]), run(["sw_vers", "-productVersion"])])
      if (n.trim()) return `${n.trim()} ${v.trim()}`
    } else if (process.platform === "linux") {
      const m = readFileSync("/etc/os-release", "utf8").match(/^PRETTY_NAME="?([^"\n]+)"?/m)
      if (m) return m[1]!
    }
  } catch {}
  return `${os.type()} ${os.release()}`
}
