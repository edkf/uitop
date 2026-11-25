#!/usr/bin/env bun
// uitop: a beginner-friendly system monitor with a three-column layout.
//   left:   Overview + sections (Apps, Developer tools, ...)
//   middle: the programs of the selected section
//   right:  details of the selected program (Overview shows the whole computer instead)
import { writeSync } from "node:fs"
import "./keyboard" // registers the key handler
import { render } from "./app"
import { startRefreshing } from "./refresh"
import { guessTheme, setTheme } from "./lib/theme"
import { renderer } from "./ui/renderer"

renderer.on("resize", render)
// Follow the terminal's light/dark mode: ask it once at start (COLORFGBG is the fallback), then keep following changes.
setTheme(guessTheme())
setTheme((await renderer.waitForThemeMode(300)) ?? guessTheme())
render()
renderer.on("theme_mode", (mode) => (setTheme(mode), render()))
// After the renderer has restored the terminal, make sure no input mode leaks into the shell.
// With the kitty keyboard protocol OpenTUI pops its flags on exit but leaves xterm's modifyOtherKeys
// (CSI > 4 ; 1 m) switched on, so the shell then receives mangled key sequences and typing breaks.
// Reset every input mode we may have enabled, then leave explicitly: stdin or the native renderer can
// otherwise keep the process alive and the prompt never comes back.
renderer.on("destroy", () =>
  setTimeout(() => {
    try {
      writeSync(1, "\x1b[>4;0m\x1b[<u\x1b[?1004l\x1b[?2004l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?25h")
    } catch {}
    process.exit(0)
  }, 50),
)
await startRefreshing()
