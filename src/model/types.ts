// Shared types and the fixed list of sections.
import { Proc } from "../data/system"
import { Kind } from "./describe"

export type SortKey = "cpu" | "mem" | "name"

/** Sections, in display order. Every process lands in exactly one, based on its type. */
export const CATS = ["Apps", "Developer tools", "Other programs", "Background services", "System"] as const
export const catOfKind = (k: Kind): number => (k === "App" || k === "Helper" ? 0 : k === "Dev" ? 1 : k === "Other" ? 2 : k === "Service" ? 3 : 4)
export const OVERVIEW = "Overview"
export const ALL = "All" // last entry of the sidebar: every program in one list

/** A row in column 2: either one process or a group of same-named processes. */
export interface Item {
  key: string // "g:<program>" | "p:<pid>"
  label: string
  kind: Kind
  p: Proc // the process it stands for (a group's main process)
  n: number
  cpu: number
  rss: number
  stat: string
  members: Proc[]
}
export interface Section {
  name: string
  isAll?: boolean // the "All" entry repeats the items of the real sections
  items: Item[]
  n: number
  cpu: number
  rss: number
}
export interface Model {
  sections: Section[]
  navList: string[]
  matchCount: number
}
