// Polls the system every 1.5 seconds and updates state.
import { flash } from "./actions/stop"
import { sampleCpu, sampleDisk, sampleMem, sampleOsName, sampleProcs } from "./data/system"
import { describe } from "./model/describe"
import { me, state } from "./state"
import { app } from "./ui/hooks"
import { renderer } from "./ui/renderer"

let busy = false
export async function refresh(): Promise<void> {
  if (busy || state.paused) return
  busy = true
  try {
    const [procs, mem, disk] = await Promise.all([sampleProcs(), sampleMem(), sampleDisk()])
    state.procs = procs
    state.info = new Map(procs.map((p) => [p.pid, describe(p, me, process.pid)]))
    state.mem = mem
    state.disk = disk
    state.cpu = sampleCpu()
    const hist = state.hist
    hist.cpu.push(state.cpu.reduce((a, b) => a + b, 0) / Math.max(1, state.cpu.length))
    hist.mem.push((mem.used / mem.total) * 100)
    if (hist.cpu.length > 600) (hist.cpu.shift(), hist.mem.shift())
    app.render()
  } catch (e: any) {
    flash(`refresh failed: ${e.message}`)
  } finally {
    busy = false
  }
}

export async function startRefreshing(): Promise<void> {
  sampleOsName().then((n) => {
    state.osName = n
  })
  sampleCpu()
  app.render()
  await refresh()
  app.render()
  const timer = setInterval(refresh, 1500)
  renderer.on("destroy", () => clearInterval(timer))
}
