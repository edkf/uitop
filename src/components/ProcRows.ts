// The facts about one process (usage, about, where it lives), shared by the details column and the process box.
import { Proc } from "../data/system"
import { fmtMem } from "../lib/format"
import { Line } from "../lib/line"
import { fit, wrap } from "../lib/text"
import { C, memColor, pctColor } from "../lib/theme"
import { cpuWord } from "../model/describe"
import { infoOf, me, state } from "../state"

/** `lead` starts every row (the column's divider, or plain padding); rows are `w` wide. */
export function processRows(p: Proc, w: number, lead: () => Line): Line[] {
  const info = infoOf(p)
  const parent = state.procs.find((q) => q.pid === p.ppid)
  const lines: Line[] = []
  // a table row: label on the left, value right-aligned (cut short with … when it does not fit)
  const kv = (k: string, v: string, fg = C.fg) => {
    const l = lead().add(" " + k, C.dim)
    const val = fit(v, Math.max(0, w - 2 - l.x)).trimEnd()
    return l.add(" ".repeat(Math.max(1, w - 1 - l.x - val.length))).add(val, fg).fill(w)
  }
  const heading = (t: string) => lines.push(lead().add(" " + t, C.dim).fill(w))
  heading("Usage")
  lines.push(kv("CPU", `${p.cpu.toFixed(1)}% · ${cpuWord(p.cpu)}`, pctColor(p.cpu * 2)))
  lines.push(kv("Memory", `${fmtMem(p.rss)} · ${p.mem.toFixed(1)}% of your RAM`, memColor(p.rss)))
  lines.push(kv("CPU time", `${p.time} in total`))
  lines.push(kv("Virtual", `${fmtMem(p.vsz)} reserved (not real use)`))
  lines.push(lead().fill(w))
  heading("About")
  lines.push(kv("Process ID", String(p.pid)))
  lines.push(kv("Owner", p.user === me ? `you (${p.user})` : p.user))
  lines.push(kv("Started by", parent ? `${infoOf(parent).name} (PID ${parent.pid})` : p.ppid <= 1 ? "the system" : `PID ${p.ppid}`))
  lines.push(lead().fill(w))
  heading("Where it lives")
  for (const s of wrap(info.path, w - 3).slice(0, 3)) lines.push(lead().add(" " + s, C.fg).fill(w))
  if (p.command !== info.path) {
    lines.push(lead().fill(w))
    heading("Full command")
    for (const s of wrap(p.command, w - 3).slice(0, 6)) lines.push(lead().add(" " + s, C.dim).fill(w))
  }
  return lines
}
