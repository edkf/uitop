// The one place that holds app state, plus read-only helpers over it.
import os from "node:os"
import { DiskInfo, MemInfo, Proc } from "./data/system"
import { Info, describe } from "./model/describe"
import { Item, Model, OVERVIEW, Section, SortKey } from "./model/types"

export const me = os.userInfo().username
export const state = {
  procs: [] as Proc[],
  info: new Map<number, Info>(),
  cpu: [] as number[],
  mem: { total: 1, used: 0, swapTotal: 0, swapUsed: 0 } as MemInfo,
  disk: { total: 1, used: 0 } as DiskInfo,
  osName: `${os.type()} ${os.release()}`,
  sort: "cpu" as SortKey,
  desc: true,
  spot: { open: false, query: "", sel: 0, top: 0 },
  paused: false,
  help: false,
  cores: false,
  status: "",
  confirm: null as null | { p: Proc; label: string; info: Info; sig: NodeJS.Signals },
  confirmFocus: 0 as 0 | 1, // 0 = Yes, 1 = No
  hist: { cpu: [] as number[], mem: [] as number[] },
  // navigation
  focus: 0 as 0 | 1 | 2,
  nav: OVERVIEW,
  itemKey: "",
  memberKey: "",
  zone: "buttons" as "buttons" | "list", // inside the right column: the action buttons, or the process list
  btn: 0 as 0 | 1, // 0 = Close program, 1 = Force stop
  top2: 0,
  top3: 0,
  follow: true,
  model: { sections: [], navList: [OVERVIEW], matchCount: 0 } as Model,
  col3Map: [] as (number | undefined)[],
  sortMembers: ((ps: Proc[]) => ps) as (ps: Proc[]) => Proc[], // sorts a group's processes with the current sort (set by buildModel)
  bottomSeps: [] as number[], // where the body's inner vertical lines end, so the footer rule can join them
}

export const infoOf = (p: Proc): Info => state.info.get(p.pid) ?? describe(p, me, process.pid)

export const curSection = (): Section | undefined => state.model.sections.find((s) => s.name === state.nav)
export function itemIdx(sec: Section | undefined): number {
  if (!sec || !sec.items.length) return -1
  const i = state.itemKey ? sec.items.findIndex((x) => x.key === state.itemKey) : 0
  return i < 0 ? 0 : i
}
export const curItem = (): Item | undefined => {
  const sec = curSection()
  const i = itemIdx(sec)
  return i < 0 ? undefined : sec!.items[i]
}
export const membersOf = (it: Item | undefined): Proc[] => (it && it.members.length > 1 ? state.sortMembers(it.members) : [])
export function memberIdx(ms: Proc[]): number {
  if (!ms.length) return -1
  const i = state.memberKey ? ms.findIndex((p) => `p:${p.pid}` === state.memberKey) : 0
  return i < 0 ? 0 : i
}
/** The process that Close / Force stop would act on. */
export function target(): { p: Proc; label: string } | undefined {
  const it = curItem()
  if (!it) return undefined
  const ms = membersOf(it)
  if (state.focus === 2 && ms.length && state.memberKey) {
    const p = ms[memberIdx(ms)]!
    return { p, label: infoOf(p).name }
  }
  return { p: it.p, label: it.n === 1 ? infoOf(it.p).name : it.label }
}
