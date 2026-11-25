// The terminal renderer and the fixed set of views (columns, footer, floating boxes).
import { BoxRenderable, type MouseEvent, RGBA, TextRenderable, createCliRenderer } from "@opentui/core"
import { enter, moveNav, openProc, selectItem, setNav } from "../actions/navigation"
import { spotMove } from "../actions/search"
import { Line, toContent } from "../lib/line"
import { C, PADY, onTheme, theme } from "../lib/theme"
import { curItem, curSection, membersOf, state } from "../state"
import { app } from "./hooks"

export const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 30, useMouse: true })
export const zonesOf = new Map<TextRenderable, Line[]>()
export type RowClick = (lx: number, ly: number) => void
export function mk(id: string, opts: { height?: number; flexGrow?: number }, onClick?: RowClick, onScroll?: (dir: number) => void) {
  const r: TextRenderable = new TextRenderable(renderer, {
    id,
    content: "",
    wrapMode: "none",
    truncate: true,
    height: opts.height,
    flexGrow: opts.flexGrow,
    onMouseDown: (e: MouseEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const lx = e.x - r.x
      const ly = e.y - r.y
      const z = zonesOf.get(r)?.[ly]?.zones.find((z) => lx >= z.x0 && lx < z.x1)
      if (z) z.fn()
      else if (state.help) state.help = false
      else onClick?.(lx, ly)
      app.render()
    },
    onMouseScroll: onScroll
      ? (e: MouseEvent) => {
          if (e.scroll && (e.scroll.direction === "up" || e.scroll.direction === "down")) onScroll(e.scroll.direction === "up" ? -1 : 1)
          app.render()
        }
      : undefined,
  } as any)
  return r
}
export const set = (r: TextRenderable, lines: Line[]) => {
  zonesOf.set(r, lines)
  r.content = toContent(lines)
}

export const root = new BoxRenderable(renderer, { id: "root", flexDirection: "column", width: "100%", height: "100%" })
export const body = new BoxRenderable(renderer, { id: "body", flexDirection: "row", flexGrow: 1, width: "100%" })
export const browseView = mk(
  "c1",
  {},
  (_lx, ly) => {
    const name = state.model.navList[ly - PADY]
    if (ly >= PADY && name) setNav(name)
  },
  (dir) => moveNav(dir),
)
export const listView = mk(
  "c2",
  {},
  (_lx, ly) => {
    const sec = curSection()
    const it = sec?.items[state.top2 + ly - 3 - PADY]
    if (ly < 3 + PADY || !it) return
    const again = it.key === state.itemKey
    selectItem(it.key)
    state.focus = 1
    if (it.members.length > 1 && again) enter()
  },
  (dir) => {
    state.follow = false
    state.top2 += dir * 3
  },
)
export const detailsView = mk(
  "c3",
  {},
  (_lx, ly) => {
    const mi = state.col3Map[ly]
    const ms = membersOf(curItem())
    if (mi !== undefined && ms[mi]) {
      state.memberKey = `p:${ms[mi]!.pid}`
      state.focus = 2
      state.zone = "list"
      state.follow = true
      openProc()
    }
  },
  (dir) => {
    state.follow = false
    state.top3 += dir * 3
  },
)
body.add(browseView)
body.add(listView)
body.add(detailsView)
export const footer = mk("footer", { height: 2 }) // a rule, then the hints
for (const r of [body, footer]) root.add(r)
renderer.root.add(root)

// Modal: a click-catching backdrop plus a centred box, both floating above everything.
export const backdrop = new BoxRenderable(renderer, {
  id: "backdrop",
  position: "absolute",
  left: 0,
  top: 0,
  width: "100%",
  height: "100%",
  zIndex: 100,
  shouldFill: true,
  backgroundColor: RGBA.fromInts(0, 0, 0, 175), // a dark veil: what is behind the box stays visible but dimmed
  onMouseDown: () => {
    state.confirm = null
    state.procModal = null
    state.spot.open = false
    app.render()
  },
} as any)
export const modal = new BoxRenderable(renderer, {
  id: "modal",
  position: "absolute",
  zIndex: 101,
  border: false,
  backgroundColor: C.modalBg,
  flexDirection: "column",
} as any)
export const modalText = mk("modalText", { flexGrow: 1 })
modal.add(modalText)
backdrop.visible = false
modal.visible = false
renderer.root.add(backdrop)
renderer.root.add(modal)

// Quick search: a floating box near the top of the screen.
export const spotBox = new BoxRenderable(renderer, {
  id: "spot",
  position: "absolute",
  zIndex: 101,
  border: false,
  backgroundColor: C.modalBg,
  flexDirection: "column",
} as any)
export const spotText = mk("spotText", { flexGrow: 1 }, undefined, (dir) => spotMove(dir))
spotBox.add(spotText)
spotBox.visible = false
renderer.root.add(spotBox)
// Boxes keep their own colours, so repaint them when the palette changes.
onTheme(() => {
  modal.backgroundColor = C.modalBg
  spotBox.backgroundColor = C.modalBg
  backdrop.backgroundColor = theme.light ? RGBA.fromInts(255, 255, 255, 175) : RGBA.fromInts(0, 0, 0, 175)
})
