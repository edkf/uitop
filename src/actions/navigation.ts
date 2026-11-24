// Moving around: sections, items, processes, sorting.
import { SortKey } from "../model/types"
import { curItem, curSection, itemIdx, memberIdx, membersOf, state } from "../state"

export function setNav(name: string): void {
  state.zone = "buttons"
  state.btn = 0
  state.nav = name
  state.itemKey = ""
  state.memberKey = ""
  state.top2 = 0
  state.top3 = 0
  state.focus = 0
  state.follow = true
}
export function moveNav(delta: number): void {
  const l = state.model.navList
  const i = Math.max(0, l.indexOf(state.nav))
  setNav(l[Math.max(0, Math.min(l.length - 1, i + delta))]!)
}
export function selectItem(key: string): void {
  state.zone = "buttons"
  state.btn = 0
  state.itemKey = key
  state.memberKey = ""
  state.top3 = 0
  state.follow = true
}
/** Move the highlight in whichever column has focus. */
export function moveSel(delta: number): void {
  state.follow = true
  if (state.focus === 0) return moveNav(delta)
  const sec = curSection()
  if (!sec) return
  if (state.focus === 1) {
    const i = itemIdx(sec)
    selectItem(sec.items[Math.max(0, Math.min(sec.items.length - 1, i + delta))]!.key)
  } else {
    const ms = membersOf(curItem())
    if (state.zone === "buttons") {
      // going down from the buttons enters the process list
      if (delta > 0 && ms.length) {
        state.zone = "list"
        if (!state.memberKey) state.memberKey = `p:${ms[0]!.pid}`
      }
      return
    }
    if (!ms.length) return
    const i = memberIdx(ms)
    if (delta < 0 && i === 0) {
      state.zone = "buttons" // going up from the first process returns to the buttons
      return
    }
    state.memberKey = `p:${ms[Math.max(0, Math.min(ms.length - 1, i + delta))]!.pid}`
  }
}
/** Go one column to the right. */
export function enter(): void {
  if (state.focus === 0) {
    const it = curItem()
    if (it) {
      state.itemKey = it.key // pin it, so it doesn't change when the CPU ranking reshuffles
      state.focus = 1
    }
  } else if (state.focus === 1) {
    if (curItem()) {
      state.focus = 2
      state.zone = "buttons" // the buttons are selected first
      state.btn = 0
      state.memberKey = ""
    }
  }
  state.follow = true
}
export function back(): void {
  state.focus = Math.max(0, state.focus - 1) as 0 | 1 | 2
  if (state.focus < 2) {
    state.memberKey = ""
    state.zone = "buttons"
    state.btn = 0
  }
  state.follow = true
}
/** Jump straight to a process: its section, its group, and the process itself. */
export function reveal(pid: number): void {
  for (const sec of state.model.sections.filter((s) => !s.isAll)) {
    const it = sec.items.find((x) => x.members.some((m) => m.pid === pid))
    if (!it) continue
    setNav(sec.name)
    selectItem(it.key)
    state.focus = it.members.length > 1 ? 2 : 1
    if (it.members.length > 1) {
      state.memberKey = `p:${pid}`
      state.zone = "list"
    }
    return
  }
}

export function setSort(k: SortKey): void {
  if (state.sort === k) state.desc = !state.desc
  else {
    state.sort = k
    state.desc = k !== "name"
  }
}
