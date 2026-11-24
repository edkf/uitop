#!/usr/bin/env bun
// uitop: a beginner-friendly system monitor with a three-column layout.
//   left:   Overview + sections (Apps, Developer tools, ...)
//   middle: the programs of the selected section
//   right:  details of the selected program (Overview shows the whole computer instead)
import "./keyboard" // registers the key handler
import { render } from "./app"
import { startRefreshing } from "./refresh"
import { renderer } from "./ui/renderer"

renderer.on("resize", render)
await startRefreshing()
