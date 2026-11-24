// Small text helpers: fit to a width, wrap.


export const fit = (s: string, w: number) => (w <= 0 ? "" : s.length > w ? s.slice(0, Math.max(0, w - 1)) + "…" : s.padEnd(w))

export const wrap = (text: string, w: number): string[] => {
  const out: string[] = []
  for (let i = 0; i < text.length; i += Math.max(1, w)) out.push(text.slice(i, i + w))
  return out.length ? out : [""]
}

/** Word wrap (for sentences; `wrap` above cuts hard, which suits paths and commands). */
export const wrapWords = (text: string, w: number): string[] => {
  const out: string[] = []
  let line = ""
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > w) (out.push(line), (line = word))
    else line = line ? line + " " + word : word
  }
  if (line) out.push(line)
  return out
}
