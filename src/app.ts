// Lays out the views and redraws everything from state.
import { setNav } from "./actions/navigation"
import { renderBrowse } from "./components/Browse"
import { renderConfirmModal } from "./components/ConfirmModal"
import { renderDetails } from "./components/Details"
import { renderFooter } from "./components/Footer"
import { renderHelp } from "./components/Help"
import { renderList } from "./components/List"
import { renderSearchModal } from "./components/SearchModal"
import { renderOverview } from "./components/overview/Overview"
import { buildModel } from "./model/build"
import { OVERVIEW } from "./model/types"
import { curSection, state } from "./state"
import { app } from "./ui/hooks"
import { browseView, detailsView, listView, renderer } from "./ui/renderer"

export function widths(W: number): [number, number, number] {
  // Browse is a compact index; the list and the details share the rest equally (50% / 50%).
  const c1 = Math.max(18, Math.min(26, Math.round(W * 0.17)))
  const rest = W - c1
  if (state.nav === OVERVIEW || state.help) return [c1, rest, 0]
  const c2 = Math.floor(rest / 2)
  return [c1, c2, rest - c2]
}

export function render(): void {
  const W = renderer.width
  const B = Math.max(3, renderer.height - 2) // the body fills everything above the footer (rule + hints)
  state.model = buildModel()
  if (!state.model.navList.includes(state.nav)) setNav(OVERVIEW)
  if (state.nav === OVERVIEW && state.focus > 0) state.focus = 0
  if (state.focus === 1 && !curSection()?.items.length) state.focus = 0

  const [w1, w2, w3] = widths(W)
  browseView.width = w1
  listView.width = w2
  detailsView.width = w3
  detailsView.visible = w3 > 0
  browseView.height = listView.height = detailsView.height = B

  renderBrowse(w1, B)
  if (state.help) renderHelp(w2, B)
  else if (state.nav === OVERVIEW) renderOverview(w2, B)
  else {
    renderList(w2, B)
    renderDetails(w3, B)
  }
  renderFooter(W, w3 > 0 ? [w1, w1 + w2] : [w1, ...state.bottomSeps.map((x) => w1 + 1 + x)])
  renderConfirmModal()
  renderSearchModal()
  state.follow = false
}

app.render = render
