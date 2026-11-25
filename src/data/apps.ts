// On Linux a program is an "app" when a .desktop launcher points at it. Those files are the
// equivalent of a macOS .app bundle: they carry the friendly name and the icon. This module
// builds a small index of them once, then answers "which app is this command line?" and
// "where is that app's icon file?".
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, isAbsolute, join } from "node:path"

export interface LinuxApp {
  /** The desktop entry's Name=, e.g. "Google Chrome". */
  name: string
  /** The desktop entry's Icon=: an icon name to look up in the themes, or an absolute path. */
  icon?: string
}

/** Environment variables that reveal which launcher started a sandboxed process. */
export interface AppEnv {
  APPIMAGE?: string
  APPDIR?: string
  FLATPAK_ID?: string
  SNAP_NAME?: string
}

interface Entry extends LinuxApp {
  /** Command paths/names this entry claims: the Exec program, TryExec, StartupWMClass. */
  tokens: string[]
  /** Chrome/Chromium web-app id (from `--app-id=` or a `crx_` window class). */
  appId?: string
  /** Flatpak application id, for processes whose command is /app/bin/... */
  flatpakId?: string
}

// Executable names that must never pull a desktop entry in by basename alone: they are shared
// by so many programs (and are usually helpers themselves) that a match would only be noise.
const GENERIC =
  /^(sh|bash|zsh|fish|dash|ksh|env|node|bun|deno|python[\d.]*|ruby|perl|java|wine|wine64|mono|electron|flatpak|snap|bwrap|dbus-daemon|dbus-broker|systemd|xdg-open|xdg-desktop-portal|gio|gtk-launch|ssh|vim|nvim|tmux|screen|make|git|docker|podman|xwayland|Xwayland)$/i

const dataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share")
const dataDirs = (process.env.XDG_DATA_DIRS || "/usr/local/share:/usr/share").split(":").filter(Boolean)
const unique = (xs: string[]) => [...new Set(xs)]

const applicationDirs = unique([
  join(dataHome, "applications"),
  ...dataDirs.map((d) => join(d, "applications")),
  join(homedir(), ".local", "share", "flatpak", "exports", "share", "applications"),
  "/var/lib/flatpak/exports/share/applications",
  "/var/lib/snapd/desktop/applications",
])

const iconRoots = unique([
  join(dataHome, "icons"),
  join(homedir(), ".icons"),
  ...dataDirs.map((d) => join(d, "icons")),
  "/usr/share/pixmaps",
  join(homedir(), ".local", "share", "flatpak", "exports", "share", "icons"),
  "/var/lib/flatpak/exports/share/icons",
  "/var/lib/snapd/desktop/icons",
])

let byPath: Map<string, Entry[]>
let byBase: Map<string, Entry[]>
let byAppId: Map<string, Entry>
let byFlatpak: Map<string, Entry>

/** Add a single value under a key: user launchers are scanned first, so the first one wins. */
function add<T>(map: Map<string, T>, key: string, value: T): void {
  if (key && !map.has(key)) map.set(key, value)
}

/** Add an entry to a list of candidates for one executable path or name. */
function push(map: Map<string, Entry[]>, key: string, entry: Entry): void {
  if (!key) return
  const list = map.get(key)
  if (list) {
    if (!list.includes(entry)) list.push(entry)
  } else map.set(key, [entry])
}

/** The program a launcher would start, after skipping `env VAR=...` and similar wrappers. */
function commandToken(exec: string): string | undefined {
  const parts = exec.trim().split(/\s+/)
  let i = 0
  while (i < parts.length && (parts[i] === "env" || /^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[i]!))) i++
  return parts[i]?.replace(/^["']|["']$/g, "")
}

function readEntry(file: string): Entry | undefined {
  let text: string
  try {
    text = readFileSync(file, "utf8")
  } catch {
    return
  }
  const vals = new Map<string, string>()
  let inEntry = false
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    if (line.startsWith("[")) {
      inEntry = line === "[Desktop Entry]"
      continue
    }
    if (!inEntry) continue
    const eq = line.indexOf("=")
    if (eq < 0) continue
    const key = line.slice(0, eq)
    if (/\[/.test(key) || vals.has(key)) continue // skip Name[de] and friends
    vals.set(key, line.slice(eq + 1))
  }
  const type = vals.get("Type") ?? "Application"
  const name = vals.get("Name")
  if (type !== "Application" || !name) return
  // NoDisplay/Hidden entries are services and helpers, not programs a person launches from the
  // app grid: matching them would put Xwayland or a portal daemon in the Apps section.
  if (vals.get("NoDisplay") === "true" || vals.get("Hidden") === "true") return
  const exec = vals.get("Exec") ?? ""
  const wmClass = vals.get("StartupWMClass")?.trim()
  const tokens: string[] = []
  const tok = commandToken(exec)
  const wrapper = tok?.match(/(?:^|\/)(flatpak|snap)$/)?.[1]
  let flatpakId: string | undefined
  if (wrapper === "flatpak") {
    // `flatpak run --command=foo org.app.Id`: the binary that actually runs is not in Exec's path.
    tokens.push(...exec.split(/\s+/).filter((a) => a.startsWith("--command=")).map((a) => a.slice(10)))
    flatpakId = exec.match(/\b([A-Za-z][\w-]*(?:\.[A-Za-z0-9_-]+)+)\b/g)?.at(-1)
  } else if (wrapper === "snap") {
    // `snap run foo`: the process usually runs from /snap/foo/... with foo as its file name.
    const snapName = exec
      .split(/\s+/)
      .filter((a) => !a.startsWith("-") && !a.startsWith("%") && !a.includes("="))
      .at(-1)
    if (snapName && !snapName.startsWith("/")) tokens.push(snapName)
  } else if (tok) {
    // Skip mapping the `flatpak`/`snap` launcher itself: every entry shares that path, so it would
    // make every sandbox helper look like whichever app happened to be scanned first.
    tokens.push(tok)
  }
  const tryExec = vals.get("TryExec")
  if (tryExec) tokens.push(tryExec.trim())
  if (wmClass) tokens.push(wmClass)
  // Chrome and friends give every installed web app its own launcher with the same Exec but a
  // distinct --app-id. The id is what tells the web app apart from the browser itself.
  const appId = exec.match(/--app-id[= ]([^\s"']+)/)?.[1] ?? wmClass?.match(/^crx_(.+)$/)?.[1]
  return { name, icon: vals.get("Icon") || undefined, tokens, appId, flatpakId }
}

function build(): void {
  byPath = new Map()
  byBase = new Map()
  byAppId = new Map()
  byFlatpak = new Map()
  for (const dir of applicationDirs) {
    let files: string[]
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".desktop")).sort()
    } catch {
      continue
    }
    for (const file of files) {
      const entry = readEntry(join(dir, file))
      if (!entry) continue
      for (const token of entry.tokens) {
        if (token.startsWith("/")) push(byPath, token, entry)
        else if (!GENERIC.test(token)) push(byBase, token, entry)
      }
      if (entry.appId) add(byAppId, entry.appId, entry)
      if (entry.flatpakId) add(byFlatpak, entry.flatpakId, entry)
    }
  }
}

const toApp = (entry: Entry | undefined): LinuxApp | undefined => entry && { name: entry.name, icon: entry.icon }

/** Choose among the launchers that share one executable; web-app launchers only match their id. */
function pick(list: Entry[] | undefined, appId?: string): Entry | undefined {
  if (!list?.length) return
  if (appId) {
    const exact = list.find((e) => e.appId === appId)
    if (exact) return exact
  }
  // Never fall back to a web-app launcher: without a matching id it would name the browser after
  // whichever installed web app happened to sort first.
  return list.find((e) => !e.appId)
}

/** The desktop app a process command line belongs to, or undefined for plain programs. */
export function linuxApp(command: string, env?: AppEnv): LinuxApp | undefined {
  if (process.platform !== "linux") return
  if (!byPath) build()
  const appId = command.match(/--app-id[= ]([^\s"']+)/)?.[1]
  if (appId) {
    const entry = byAppId.get(appId)
    if (entry) return toApp(entry)
  }
  const token = commandToken(command) ?? command.split(/\s+/)[0]
  let entry = token ? (pick(byPath.get(token), appId) ?? pick(byBase.get(basename(token)), appId)) : undefined
  if (!entry) {
    // A sandboxed process runs from /tmp/.mount_... (AppImage), /app/... (Flatpak) or /snap/...,
    // where its own path means nothing. The environment of it or a parent names the launcher.
    if (env?.APPIMAGE) entry = pick(byPath.get(env.APPIMAGE)) ?? pick(byBase.get(basename(env.APPIMAGE)))
    else if (env?.FLATPAK_ID) entry = byFlatpak.get(env.FLATPAK_ID)
    else if (env?.SNAP_NAME) entry = pick(byBase.get(env.SNAP_NAME))
  }
  if (!entry) {
    const snap = token?.match(/^\/snap\/([^/]+)\//)?.[1]
    if (snap) entry = pick(byBase.get(snap))
  }
  return toApp(entry)
}

// ---- icons ---------------------------------------------------------------
// Look ups are memoized: a handful of apps means a handful of directory scans, done lazily and
// in the background by the icon renderer, never on the drawing path.
const iconMemo = new Map<string, string | undefined>()
const themeDirMemo = new Map<string, string[]>()
const sizeDirMemo = new Map<string, string[]>()

/** Directories directly under an icon root that look like themes (they hold size folders). */
function themesOf(root: string): string[] {
  const hit = themeDirMemo.get(root)
  if (hit) return hit
  let dirs: string[] = []
  try {
    dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {}
  themeDirMemo.set(root, dirs)
  return dirs
}

function sizesOf(theme: string): string[] {
  const hit = sizeDirMemo.get(theme)
  if (hit) return hit
  let dirs: string[] = []
  try {
    dirs = readdirSync(theme, { withFileTypes: true })
      .filter((d) => d.isDirectory() && (/^\d+(x\d+)?(@\d+x)?$/.test(d.name) || d.name === "scalable"))
      .map((d) => d.name)
      .sort((a, b) => (a === "scalable" ? -1 : b === "scalable" ? 1 : parseInt(b) - parseInt(a)))
  } catch {}
  sizeDirMemo.set(theme, dirs)
  return dirs
}

/** The best icon file on disk for a desktop entry's Icon= value, if any. */
export function findIconFile(icon: string): string | undefined {
  if (process.platform !== "linux") return
  if (iconMemo.has(icon)) return iconMemo.get(icon)
  const found = isAbsolute(icon) ? (existsSync(icon) ? icon : undefined) : searchIcon(icon)
  iconMemo.set(icon, found)
  return found
}

function searchIcon(icon: string): string | undefined {
  const found: { file: string; score: number }[] = []
  const consider = (file: string, svg: boolean, size?: number) => {
    if (!existsSync(file)) return
    // a big PNG is best; an SVG scales to any size but needs a converter, so it sits in the middle
    found.push({ file, score: svg ? Math.min(size ?? 192, 192) : size ?? 16 })
  }
  // Icon= may be a bare theme name or already carry its extension.
  const exts = /\.(png|svg)$/i.test(icon) ? [""] : [".png", ".svg"]
  const svg = (ext: string) => ext === ".svg" || (ext === "" && /\.svg$/i.test(icon))
  for (const root of iconRoots) {
    for (const ext of exts) consider(join(root, icon + ext), svg(ext))
    for (const theme of themesOf(root)) {
      const dir = join(root, theme)
      // Flatpak and snap export their icons as a single apps/ folder under the theme.
      for (const ext of exts) consider(join(dir, "apps", icon + ext), svg(ext))
      for (const size of sizesOf(dir)) {
        for (const cat of ["apps", "devices", ""]) {
          for (const ext of exts) {
            const n = size === "scalable" ? undefined : parseInt(size)
            consider(join(dir, size, cat, icon + ext), svg(ext), n)
          }
        }
      }
    }
  }
  return found.sort((a, b) => b.score - a.score)[0]?.file
}
