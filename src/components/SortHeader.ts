// A column heading that doubles as a sort button.
import { setSort } from "../actions/navigation"
import { Line } from "../lib/line"
import { fit } from "../lib/text"
import { C, SORT_ASC, SORT_DESC } from "../lib/theme"
import { SortKey } from "../model/types"
import { state } from "../state"

/**
 * A clickable column heading that sorts the list. Every sortable heading keeps a chevron, so the
 * columns never change width or position: faint when it is not the sort key, white when it is
 * (▾ descending, ▴ ascending).
 */
export function sortHeader(l: Line, text: string, k: SortKey, width: number, right = false, members = false): void {
  const on = (members ? state.msort : state.sort) === k
  const chev = on && !(members ? state.mdesc : state.desc) ? SORT_ASC : SORT_DESC
  const s = `${text} ${chev}`
  const cell = right ? s.padStart(width).slice(-width) : fit(s, width)
  const at = cell.lastIndexOf(chev) // -1 when a narrow column cut the text
  l.zones.push({ x0: l.x, x1: l.x + cell.length, fn: () => setSort(k, members) })
  if (at < 0) {
    l.add(cell, "#ffffff")
    return
  }
  l.add(cell.slice(0, at), "#ffffff")
  l.add(chev, on ? "#ffffff" : C.faint)
  l.add(cell.slice(at + 1), "#ffffff")
}
