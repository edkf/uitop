// Lets low-level modules ask for a redraw without importing the whole UI.
import { render } from "../app"

export const app = { render: () => {} }
