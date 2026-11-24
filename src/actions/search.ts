// Quick search: state and jumping to a result.
import { reveal } from "./navigation"
import { Proc } from "../data/system"
import { infoOf, state } from "../state"

export function startSearch(): void {
  state.spot = { open: true, query: "", sel: 0, top: 0 }
  state.help = false
  state.confirm = null
}
export const closeSpot = () => (state.spot.open = false)
/** Matches by name, group, PID, owner or command line; best matches first. Empty query = busiest programs. */
export function spotResults(): Proc[] {
  const q = state.spot.query.trim().toLowerCase()
  if (!q) return [...state.procs].sort((a, b) => b.cpu - a.cpu).slice(0, 50)
  const scored: [number, Proc][] = []
  for (const p of state.procs) {
    const info = infoOf(p)
    const name = info.name.toLowerCase()
    const group = info.group.toLowerCase()
    let score = -1
    if (String(p.pid) === q) score = 100
    else if (name.startsWith(q) || group.startsWith(q)) score = 80
    else if (name.includes(q) || group.includes(q)) score = 60
    else if (p.command.toLowerCase().includes(q)) score = 30
    else if (p.user.toLowerCase() === q) score = 20
    if (score >= 0) scored.push([score, p])
  }
  scored.sort((a, b) => b[0] - a[0] || b[1].cpu - a[1].cpu)
  return scored.slice(0, 200).map((x) => x[1])
}
export function spotMove(delta: number): void {
  const n = spotResults().length
  state.spot.sel = Math.max(0, Math.min(Math.max(0, n - 1), state.spot.sel + delta))
}
/** Close the search and land on the process's section, with it highlighted. */
export function jumpTo(pid: number): void {
  closeSpot()
  state.help = false
  reveal(pid)
}
