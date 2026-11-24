// Turns the process list into sections, groups and items.
import { Proc } from "../data/system"
import { ALL, CATS, Item, Model, OVERVIEW, Section, SortKey, catOfKind } from "./types"
import { infoOf, state } from "../state"

/** Filter, group same-named processes, file them under sections, and sort. */
export function buildModel(): Model {
  const matches = state.procs
  const dir = state.desc ? -1 : 1
  type Sortable = { cpu: number; rss: number; label: string }
  const cmp: Record<SortKey, (a: Sortable, b: Sortable) => number> = {
    cpu: (a, b) => a.cpu - b.cpu || a.rss - b.rss,
    mem: (a, b) => a.rss - b.rss,
    name: (a, b) => a.label.localeCompare(b.label),
  }
  const order = (a: Sortable, b: Sortable) => dir * cmp[state.sort](a, b)
  const asSortable = (p: Proc): Sortable => ({ cpu: p.cpu, rss: p.rss, label: infoOf(p).name })
  state.sortMembers = (ps) => [...ps].sort((a, b) => order(asSortable(a), asSortable(b)))

  const byGroup = new Map<string, Proc[]>()
  for (const p of matches) {
    const g = infoOf(p).group
    byGroup.set(g, [...(byGroup.get(g) ?? []), p])
  }
  const buckets: Item[][] = CATS.map(() => [])
  for (const [name, ps] of byGroup) {
    // a group goes in the most "user-facing" section any of its processes belongs to
    const sec = Math.min(...ps.map((p) => catOfKind(infoOf(p).kind)))
    const sorted = [...ps].sort((a, b) => a.pid - b.pid)
    const main = sorted.find((p) => infoOf(p).kind !== "Helper") ?? sorted[0]!
    const mainKind = infoOf(main).kind
    const single = ps.length === 1
    buckets[sec]!.push({
      key: single ? `p:${main.pid}` : `g:${name}`,
      label: single ? infoOf(main).name : name,
      kind: single ? mainKind : mainKind === "Helper" ? "App" : mainKind,
      p: main,
      n: ps.length,
      cpu: ps.reduce((a, p) => a + p.cpu, 0),
      rss: ps.reduce((a, p) => a + p.rss, 0),
      stat: [...ps].sort((a, b) => b.cpu - a.cpu)[0]!.stat,
      members: ps,
    })
  }
  const sections: Section[] = []
  CATS.forEach((name, i) => {
    const items = buckets[i]!.sort(order)
    if (!items.length) return
    sections.push({
      name,
      items,
      n: items.reduce((a, r) => a + r.n, 0),
      cpu: items.reduce((a, r) => a + r.cpu, 0),
      rss: items.reduce((a, r) => a + r.rss, 0),
    })
  })
  // "All" is a view, not a section: every item of every section in one list
  const everything = sections.flatMap((s) => s.items).sort(order)
  if (everything.length) {
    sections.push({
      name: ALL,
      isAll: true,
      items: everything,
      n: everything.reduce((a, r) => a + r.n, 0),
      cpu: everything.reduce((a, r) => a + r.cpu, 0),
      rss: everything.reduce((a, r) => a + r.rss, 0),
    })
  }
  return { sections, navList: [OVERVIEW, ...sections.map((s) => s.name)], matchCount: matches.length }
}
