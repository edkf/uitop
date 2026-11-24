// Click a headline number on the Overview to sort the lists by it.
import { flash } from "../../actions/stop"
import { SortKey } from "../../model/types"
import { state } from "../../state"

export const sortBy = (k: SortKey, name: string) => () => {
  state.sort = k
  state.desc = true
  flash(`Sorted by ${name}. Pick a section on the left to see the list.`)
}
