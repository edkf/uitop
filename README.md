# uitop

A terminal system monitor for people who don't read process tables.

uitop lists every running program in plain language, folds helper processes into the app they belong to, and shows what is slowing your computer down. Built with [Bun](https://bun.sh) and [OpenTUI](https://opentui.com).

## What it does

- **Overview.** A dashboard of six blocks: CPU, Memory, the programs using the most CPU, the programs using the most memory, programs per section, and facts about the machine (system, processor, uptime, disk, load). CPU and memory keep a live history chart.
- **Plain-language list.** Every process gets a readable name, a type, and a status word (Working, Idle, Paused, Stuck) instead of `Ss` or `R+`.
- **Sections.** Programs are sorted into Apps, Developer tools, Other programs, Background services and System. **All** lists every program in one place.
- **Groups.** Processes of the same program collapse into one row: `Browser ×16` is the app plus its 15 helpers. Open it to see each process.
- **Quick search.** Press `/` to search every process by name, PID, owner or command. Enter jumps to it.
- **Safe stop.** Close program (SIGTERM) and Force stop (SIGKILL) always ask first in a modal. Risky targets (system programs, other users' processes) default to "No".
- **Mouse and keyboard.** Use either.

## Layout

```
Browse            List                         Details
-----------       -------------------------    -------------------------
Overview          Name         CPU   Memory    Terminal  App
Apps              Terminal ×4  27%   449 MB    4 processes together
Developer tools   Browser ×20  19%   4.7 GB    [Close program] [Force stop]
Other programs    ...                          Processes inside (4)
Background svcs                                ...
System
```

The list and the details column share the width equally. Overview replaces both with the dashboard.

## Controls

| Key | Action |
| --- | --- |
| `↑` `↓` / `j` `k` | Choose |
| `→` / `l` / `Enter` | Go in (list → buttons → processes) |
| `←` / `h` / `Esc` | Go back |
| `Tab` / `Shift+Tab` | Next / previous section |
| `/` | Search |
| `c` `m` `n` | Sort by CPU / Memory / Name (again to reverse) |
| `r` | Reverse the sort |
| `x` / `X` | Close program / Force stop |
| `Space` | Pause updates |
| `?` | Help |
| `q` | Quit |

Mouse: click to select, click a group again to open it, scroll any column with the wheel, click `Name`, `CPU` or `Memory` to sort, click a name in the Overview lists to jump to it.

## Where the data comes from

Everything is read from the local machine. No network access, no telemetry, no hardcoded process names or descriptions.

| Data | macOS | Linux |
| --- | --- | --- |
| Processes | `ps` | `ps` |
| CPU, load, uptime | Node `os` | Node `os` |
| Memory, swap | `vm_stat`, `sysctl vm.swapusage` | `/proc/meminfo` |
| Disk | `df` (data volume) | `df` |
| System name | `sw_vers` | `/etc/os-release` |

Data refreshes every 1.5 seconds.

## How programs are classified

A program's name, group and type come from its executable path and its owner, nothing else:

- Anything inside a `.app` bundle is named after the bundle. Helpers, renderers and GPU processes are labeled as helpers of that app.
- Interpreters are named after the script they run (`node server.js`).
- System paths and system accounts mark System and Background services.

These are heuristics. A process can land in the wrong section.

## Platforms

- **macOS:** developed and tested here.
- **Linux:** implemented, not tested.
- **Windows:** not supported.

## Known limits

- Group memory is a sum of resident memory. Shared memory is counted more than once, so group totals read high.
- Stopping a process you don't own fails without elevated privileges. uitop tells you instead of failing silently.
- Section and type are guesses, not facts. See above.
- The refresh interval is fixed.

## Project layout

Components are plain functions that turn state into rows of styled text, organized the way a React app would be: small views under `components/`, shared state, actions that change it, and a thin entry point.

```
src/
  index.ts            entry point
  app.ts              layout and the redraw loop
  keyboard.ts         key handling
  refresh.ts          polls the system every 1.5 s
  state.ts            the single state object and read-only helpers
  actions/            navigation, stop/force-stop, quick search
  model/              types, grouping into sections, name/type classification
  data/system.ts      processes, CPU, memory, disk
  lib/                theme, text, formatting, the Line row type
  ui/                 terminal renderer and the fixed set of views
  components/         Browse, List, Details, Help, Footer, modals, SortHeader
  components/overview/ dashboard blocks: CPU, Memory, lists, Programs, About
```

## Status

Early. Expect rough edges and layout changes.
