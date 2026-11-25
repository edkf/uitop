// Turns raw `ps` rows into something a beginner can read:
// a friendly name and a type badge. No hand-written explanations: everything derives from the process list.
import { readFileSync } from "node:fs"
import { AppEnv, LinuxApp, linuxApp } from "../data/apps"
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
  /** Desktop icon file or name on Linux. macOS uses the .app bundle in the command instead. */
  icon?: string
}

const DEV =
  /^(node|bun|npm|npx|pnpm|yarn|deno|python[\d.]*|ruby|perl|java|php|go|cargo|rustc|git|ssh|vim|nvim|tmux|zsh|bash|fish|sh|docker|make|tsc|esbuild|vite|login|screen)$/
const INTERP = /^(node|bun|deno|python[\d.]*|ruby|perl|java|php)$/
const SYSTEM_PATH = /^\/(System|usr\/(libexec|sbin|bin|lib)|sbin|bin|lib|lib64|Library\/Apple)\b/

export function describe(p: Proc, me: string, selfPid: number): Info {
  const cmd = p.command
  const appMatch = cmd.match(/([^/]+)\.app\//)
  const inSystem = SYSTEM_PATH.test(cmd)

  // ---- Linux desktop entries (apps and their helpers) -----------------------
  // A .desktop launcher is the Linux equivalent of a .app bundle: it knows the friendly name and
  // the icon. Matching by executable path (or, failing that, by file name) is what puts a program
  // in the Apps section on Linux.
  if (process.platform === "linux") {
    const lin = linuxApp(cmd)
    if (lin) {
      const helper = helperKind(cmd)
      const friendly = p.user === "root" || p.user.startsWith("_") ? "Service" : "App"
      const path = cmd.split(/\s+/)[0]!
      if (helper) return { name: `${lin.name} · ${helper}`, kind: "Helper", group: lin.name, path, icon: lin.icon }
      return { name: lin.name, kind: friendly, group: lin.name, path, icon: lin.icon }
    }
  }

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

const baseOf = (cmd: string): string => {
  const tok = cmd.split(/\s+/)[0] ?? cmd
  return tok.slice(tok.lastIndexOf("/") + 1)
}

/** "renderer", "gpu", "crash handler": what a helper process does, when its command says so. */
function helperKind(cmd: string): string | undefined {
  const type = cmd.match(/--type[= ]([a-z][a-z-]*)/i)?.[1]
  if (type) return type === "gpu-process" ? "gpu" : type
  const base = baseOf(cmd)
  if (/crashpad|crash-handler/i.test(base)) return "crash handler"
  if (/^WebKit(Web|Network|GPU|WebExtension)Process$/i.test(base)) return base.replace(/^WebKit|Process$/g, "").toLowerCase()
  if (/^QtWebEngineProcess$/i.test(base)) return "web engine"
  return undefined
}

// An AppImage unpacks itself into /tmp/.mount_<something> and runs the real binary from there.
const APPIMAGE_MOUNT = /^(.+\/\.mount_[^/]+)\//

function readEnv(pid: number): AppEnv {
  const env: AppEnv = {}
  try {
    for (const kv of readFileSync(`/proc/${pid}/environ`).toString("utf8").split("\0")) {
      const eq = kv.indexOf("=")
      if (eq < 1) continue
      const key = kv.slice(0, eq)
      if (key === "APPIMAGE" || key === "FLATPAK_ID" || key === "SNAP_NAME" || key === "APPDIR") env[key] = kv.slice(eq + 1)
    }
  } catch {}
  return env
}

/** The sandbox environment of a process or its nearest ancestor that has one. */
function envOf(pid: number, byPid: Map<number, Proc>, cache: Map<number, AppEnv>): AppEnv {
  const path: number[] = []
  for (let cur = pid, depth = 0; cur > 1 && depth < 10; depth++) {
    const hit = cache.get(cur)
    if (hit) return hit
    path.push(cur)
    const env = readEnv(cur)
    if (env.APPIMAGE || env.FLATPAK_ID || env.SNAP_NAME) {
      for (const p of path) cache.set(p, env)
      return env
    }
    cache.set(cur, {})
    cur = byPid.get(cur)?.ppid ?? 0
  }
  return {}
}

/** Point a process at a desktop entry, keeping its helper suffix when it is a renderer or the like. */
function applyApp(p: Proc, info: Info, app: LinuxApp, infos: Map<number, Info>): void {
  const helper = helperKind(p.command)
  infos.set(p.pid, {
    name: helper ? `${app.name} · ${helper}` : app.name,
    kind: helper ? "Helper" : p.user === "root" || p.user.startsWith("_") ? "Service" : "App",
    group: app.name,
    path: info.path,
    icon: app.icon,
  })
}

/**
 * AppImage, Flatpak and snap programs run from unpacked paths that no .desktop file mentions.
 * Their environment names the launcher they came from, so use it to put them in the right app.
 */
export function foldSandboxes(procs: Proc[], infos: Map<number, Info>): void {
  if (process.platform !== "linux") return
  const byPid = new Map(procs.map((p) => [p.pid, p]))
  const cache = new Map<number, AppEnv>()
  // resolve each AppImage mount once, so its crash handlers (whose parent is already gone) get it too
  const mounts = new Map<string, LinuxApp>()
  for (const p of procs) {
    const root = p.command.match(APPIMAGE_MOUNT)?.[1]
    if (!root || mounts.has(root)) continue
    // resolve the mount itself, not a web-app window that happens to run inside it
    const env = envOf(p.pid, byPid, cache)
    const app = env.APPIMAGE ? linuxApp(env.APPIMAGE) : linuxApp(p.command, env)
    if (app) mounts.set(root, app)
  }
  for (const p of procs) {
    const info = infos.get(p.pid)
    if (!info || info.kind === "System") continue
    const root = p.command.match(APPIMAGE_MOUNT)?.[1]
    if (!root && !/^\/app\//.test(p.command) && !/^\/snap\//.test(p.command)) continue
    const app = linuxApp(p.command, envOf(p.pid, byPid, cache)) ?? (root ? mounts.get(root) : undefined)
    if (app) applyApp(p, info, app, infos)
  }
}

// Helpers that are genuinely separate programs (and so do not match the app's own executable).
const LOOSE_HELPER = /(crashpad|crash-handler|WebKit(Web|Network|GPU|WebExtension)Process|QtWebEngineProcess|1Password-(BrowserSupport|Crash-Handler))/i

// Programs sharing one of these folders are unrelated system binaries, not an app and its helper.
const SYSTEM_DIR = /^\/(usr\/)?(bin|sbin|lib|libexec|lib64)(\/|$)/
const dirOf = (path: string): string => {
  const i = path.lastIndexOf("/")
  return i > 0 ? path.slice(0, i) : ""
}

/**
 * Linux apps start their helpers as separate executables rather than as children inside their
 * bundle. Walk each loose helper's parents until an app is found and fold it into that app,
 * the way macOS helpers are folded by their .app path.
 */
export function foldHelpers(procs: Proc[], infos: Map<number, Info>): void {
  if (process.platform !== "linux") return
  const byPid = new Map(procs.map((p) => [p.pid, p]))
  // a helper whose parent is already gone can still be recognized by living next to its app
  const appByDir = new Map<string, Info>()
  for (const info of infos.values()) {
    const dir = info.kind === "App" ? dirOf(info.path) : ""
    if (dir && !SYSTEM_DIR.test(dir) && !appByDir.has(dir)) appByDir.set(dir, info)
  }
  for (const p of procs) {
    const info = infos.get(p.pid)
    if (!info || info.kind === "App" || info.kind === "Helper" || info.kind === "System" || info.kind === "Service") continue
    const helper = helperKind(p.command)
    if (!helper && !LOOSE_HELPER.test(baseOf(p.command))) continue
    // a helper living in the app's own folder (a crash handler, a web engine) is the surest match
    let owner: Info | undefined = appByDir.get(dirOf(info.path))
    for (let pid = p.ppid, depth = 0; pid > 0 && depth < 10 && !owner; depth++) {
      const parent = infos.get(pid)
      if (!parent) break
      if (parent.kind === "App") owner = parent
      pid = byPid.get(pid)?.ppid ?? 0
    }
    if (owner) {
      infos.set(p.pid, {
        name: `${owner.name} · ${helper ?? "helper"}`,
        kind: "Helper",
        group: owner.group,
        path: info.path,
        icon: owner.icon,
      })
    }
  }
}

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
