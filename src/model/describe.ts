// Turns raw `ps` rows into something a beginner can read:
// a friendly name and a type badge. No hand-written explanations: everything derives from the process list.
import { Proc } from "../data/system"
import { me } from "../state"
import { app } from "../ui/hooks"
import { root } from "../ui/renderer"

export type Kind = "App" | "Helper" | "System" | "Dev" | "Service" | "Other"

export interface Info {
  name: string
  kind: Kind
  /** Key used to merge processes of the same program/app into one group. */
  group: string
  path: string
}

const DEV =
  /^(node|bun|npm|npx|pnpm|yarn|deno|python[\d.]*|ruby|perl|java|php|go|cargo|rustc|git|ssh|vim|nvim|tmux|zsh|bash|fish|sh|docker|make|tsc|esbuild|vite|login|screen)$/
const INTERP = /^(node|bun|deno|python[\d.]*|ruby|perl|java|php)$/
const SYSTEM_PATH = /^\/(System|usr\/(libexec|sbin|bin|lib)|sbin|bin|lib|lib64|Library\/Apple)\b/

export function describe(p: Proc, me: string, selfPid: number): Info {
  const cmd = p.command
  const appMatch = cmd.match(/([^/]+)\.app\//)
  const inSystem = SYSTEM_PATH.test(cmd)

  // ---- .app bundles (apps and their helpers) --------------------------------
  if (appMatch && !(inSystem && cmd.startsWith("/System/Library/Frameworks"))) {
    const app = appMatch[1]!
    const argAt = cmd.search(/ --?[A-Za-z]/)
    const pathPart = argAt < 0 ? cmd : cmd.slice(0, argAt)
    const execBase = pathPart.slice(pathPart.lastIndexOf("/") + 1)
    const helper = /Helper|Renderer|GPU|Plugin|XPC|\.xpc\//i.test(execBase + pathPart.slice(-80))
    const suffix = execBase.match(/\(([^)]+)\)/)?.[1]
    const path = argAt < 0 ? cmd : pathPart
    if (helper) return { name: `${app} · ${suffix ?? "helper"}`, kind: "Helper", group: app, path }
    if (inSystem) return { name: app, kind: "System", group: app, path }
    const root = p.user === "root" || p.user.startsWith("_")
    return { name: app, kind: root ? "Service" : "App", group: app, path }
  }

  // ---- plain executables ----------------------------------------------------
  const parts = cmd.split(/\s+/)
  const tok = parts[0]!
  const base = tok.slice(tok.lastIndexOf("/") + 1).replace(/^-/, "")
  const lower = base.toLowerCase()
  let name = base || tok
  if (INTERP.test(lower)) {
    const script = parts.slice(1).find((a) => !a.startsWith("-"))
    if (script) name = `${base} ${script.slice(script.lastIndexOf("/") + 1)}`
  }

  let kind: Kind
  if (pidIsSelf(p, selfPid)) kind = "Dev"
  else if (DEV.test(lower)) kind = "Dev"
  else if (inSystem || lower === "kernel_task" || lower === "launchd") kind = "System"
  else if (p.user === "root" || p.user.startsWith("_") || /d$/.test(lower)) kind = p.user === me ? "Other" : "Service"
  else kind = "Other"

  return { name, kind, group: base || tok, path: tok }
}

const pidIsSelf = (p: Proc, selfPid: number) => p.pid === selfPid

export const kindColor: Record<Kind, string> = {
  App: "#3fb950",
  Helper: "#39c5cf",
  System: "#58a6ff",
  Dev: "#bc8cff",
  Service: "#d29922",
  Other: "#8b949e",
}

export function statusWord(stat: string): { word: string; why: string; color: string } {
  switch (stat[0]) {
    case "R":
      return { word: "Working", why: "actively using the CPU right now", color: "#3fb950" }
    case "S":
    case "I":
      return { word: "Idle", why: "waiting for something to do. Completely normal", color: "#6e7681" }
    case "T":
      return { word: "Paused", why: "frozen (stopped) until something resumes it", color: "#d29922" }
    case "Z":
      return { word: "Stuck", why: "a finished program that was never cleaned up (a \"zombie\"). Harmless but untidy", color: "#f85149" }
    case "U":
      return { word: "Waiting", why: "waiting on the disk or network", color: "#d29922" }
    default:
      return { word: stat, why: "unusual state", color: "#8b949e" }
  }
}

export function cpuWord(cpu: number): string {
  if (cpu < 1) return "barely anything"
  if (cpu < 10) return "a little"
  if (cpu < 50) return "a moderate amount"
  if (cpu < 100) return "a lot"
  return "more than one whole CPU core, which is very heavy"
}
