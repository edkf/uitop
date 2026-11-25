// About this computer: identity, plus disk and load as inline meters.
import os from "node:os"
import { meter } from "./Meter"
import { panel } from "./Panel"
import { Metrics, level } from "./metrics"
import { fmtUptime } from "../../lib/format"
import { Line } from "../../lib/line"
import { fit } from "../../lib/text"
import { C } from "../../lib/theme"
import { me, state } from "../../state"

export const aboutPanel = (m: Metrics) => (pw: number, ph: number): Line[] =>
  panel("About this computer", pw, ph, (iw, ih) => {
    const [diskWordL, diskC] = m.disk
    const [loadWordL, loadC] = level(m.loadPct, "load", ["calm", "calm", "busy", "overloaded"])
    const kv = (k: string, v: string) => new Line().add(" " + k.padEnd(10), C.dim).add(fit(v, Math.max(0, iw - 12)).trimEnd(), C.fg)
    const gb = (bytes: number) => `${Math.round(bytes / 2 ** 30)}G` // whole gigabytes keep the row short
    // left: label + numbers · right: status word + meter (the meters line up in one column)
    const diskNum = `${gb(state.disk.total - state.disk.used)} free`
    const loadNum = m.load.map((x) => x.toFixed(1)).join(" / ")
    const numW = Math.max(diskNum.length, loadNum.length)
    const wordW = Math.max(diskWordL.length, loadWordL.length)
    const showWord = iw - 1 - 11 - numW - 1 - 6 - (wordW + 1) >= 1 // is there room for the status word?
    const inline = (label: string, num: string, word: string, pct: number, c: string) => {
      const l = new Line().add(" " + label.padEnd(10), C.dim).add(num, C.text)
      const rightW = (showWord ? wordW + 1 : 0) + 5
      l.add(" ".repeat(Math.max(1, iw - 1 - l.x - rightW)))
      if (showWord) l.add(word.padStart(wordW), c).add(" ")
      return l.append(meter(pct, 5, c))
    }
    // [priority, line]: when the block is short, the least important lines go first
    const rows: [number, Line][] = [
      [4, kv("Name", os.hostname())],
      [5, kv("System", state.osName)],
      [6, kv("Processor", `${(m.cpus[0]?.model ?? "unknown").replace(/\(R\)|\(TM\)/g, "")} · ${m.cpus.length} cores · ${os.arch()}`)],
      [3, kv("On for", fmtUptime(os.uptime()).replace(/:\d\d$/, ""))],
      [2, kv("You are", me)],
      [9, inline("Disk", diskNum, diskWordL, m.diskPct, diskC)],
      [8, inline("Busy", loadNum, loadWordL, m.loadPct, loadC)],
    ]
    while (rows.length > ih) {
      const lowest = Math.min(...rows.map((r) => r[0]))
      rows.splice(rows.findIndex((r) => r[0] === lowest), 1)
    }
    return rows.map((r) => r[1])
  })
