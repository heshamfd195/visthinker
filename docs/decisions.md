# ⭐ Decisions

The decisions that shape this repo, one plain sentence each.
The D-numbers match the ones in commit messages and code comments, so `D91` in a comment is the `D91` row here.
Only this repo's decisions are listed, so the numbers have gaps. When a later decision changed one, the row shows where things stand now.

## 🎯 What it is

| ID   | decision                                                                                                                                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01  | 🎯 Visual Thinker is a shared visual channel between you and an AI: you point, it understands, and you both work on the same thing.                                                                                                                         |
| D46  | ❤️ The drawing part is the heart of the app and is never cut.                                                                                                                                                                                               |
| D66  | 🎮 Interacting is the core: playing, learning and contributing can all happen at once, inside one project.                                                                                                                                                  |
| D22  | 🔌 The first version is the open app connected to Claude Code through MCP.                                                                                                                                                                                  |
| D70  | 🧑‍💻 Your local Claude Code is the one that reads, plays and replies.                                                                                                                                                                                         |
| D150 | 🔌 Visual Thinker runs as an MCP server inside Claude Code, on your Claude subscription, with no API key (a canvas with its own Claude, D148 and D149, was dropped).                                                                                        |
| D73  | 🔓 Open core: the app works fully on your machine; an optional hosted pack API can add packs later, and you can plug in your own.                                                                                                                           |
| D75  | 📄 The app is MIT licensed.                                                                                                                                                                                                                                 |
| D160 | 🧱 Four layers stay apart: the **project** (what you're doing) picks which **knowledge packs** are in play, the **library** holds things you put on the canvas, and **abilities** handle your input; a pack may suggest itself but never starts on its own. |
| D161 | ✋ Abilities are how the canvas reads your input (handwriting, smart selection): built in, on by default, each can be switched off, and you can build your own.                                                                                             |
| D162 | 🧹 Tic-tac-toe is removed for now, to be rebuilt later around projects; the modes, the pack format, the `$P` reader and the reading of lines, crossings and shapes stay.                                                                                    |
| D52  | 🏷️ The code and package name is `visthinker` (the public name changed by D163).                                                                                                                                                                             |
| D163 | 🏷️ The repo is `visual-thinker` and the README title is Visual Thinker; the npm package, the install command and the code's package names stay `visthinker`.                                                                                                |
| D164 | 📖 This repo documents itself only: README, CLAUDE.md, and `docs/` with architecture, decisions, journey, design system, user stories, changes, drawings and images.                                                                                        |
| D165 | 🌙 Every drawing in the docs is dark: Excalidraw's dark theme for the source, and a dark export for the SVG.                                                                                                                                                |

## 🖼️ Canvas & UI

| ID   | decision                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D04  | 🖼️ The canvas is an infinite 2D board with panels that open and collapse (the layout itself is D119).                                                                                               |
| D28  | 🖥️ The canvas opens in a browser tab, next to your terminal.                                                                                                                                        |
| D32  | 🖌️ The canvas is drawn with Konva, with freehand ink from perfect-freehand and pen pressure.                                                                                                        |
| D10  | 🧠 The frontend turns clicks, drags and drawings into compact events before they are sent.                                                                                                          |
| D67  | 🎨 The canvas has colours, pre-built artifacts, arrows and connectors, so every object is data from the start.                                                                                      |
| D119 | 🗺️ The layout is the full UI on a black, greyscale canvas: projects top left, toolbar top, modes top right, a side bar on the right, settings bottom left, chat bottom centre, events bottom right. |
| D120 | 🧰 The toolbar holds the drawing tools, then undo and redo, then a "⋯" menu with save, export and clear.                                                                                            |
| D121 | 🪟 The UI has three states: open, collapsed and focus; the toolbar never collapses.                                                                                                                 |
| D122 | 📦 The packs panel lists installed packs with an on/off switch each, marks "your copy" on a pack you changed, and lets you make a new pack.                                                         |
| D123 | 📚 The library panel holds things you put on the canvas (artifacts and symbols); the side bar is library, packs and guides (changed by D156).                                                       |
| D124 | 📐 Guides are background only: the Fast Brain never reads them as strokes.                                                                                                                          |
| D156 | 📐 One guide at a time (none, dots, grid or lines, with an optional writing guide), three opacities, dotted lines, and snap for dots and grid.                                                      |
| D125 | 🗂️ The projects menu is a drawer at the top left; a project is one canvas with many chats with Claude.                                                                                              |
| D126 | 💬 The chat sits at the bottom centre: Claude's own typeface, answer buttons, chips that point at objects, and changes to your drawing as proposals you apply or dismiss.                           |
| D127 | 📜 The events box shows Claude's status and thinking time, filters, a timed list of what happened with each tool call's time, plain words by default and the raw event on click.                    |
| D128 | ⚙️ Settings open as a window with seven sections: appearance, drawing, reading, Claude, privacy, shortcuts, about.                                                                                  |
| D47  | 🔐 Saving your session stories is opt-in, off by default, and keeps nothing personal.                                                                                                               |
| D135 | 👉 Whatever is selected when you send a message travels with it as a chip.                                                                                                                          |
| D136 | 📍 Claude's replies always go to the chat, with a small dot on the canvas next to what they are about; Claude never writes text onto the canvas directly.                                           |
| D137 | ⏸️ No file attachments or microphone in the chat yet.                                                                                                                                               |
| D140 | 🧩 The UI is built with shadcn/ui (Radix with Tailwind), copied into the repo and stripped to greyscale, with dark and light themes.                                                                |
| D144 | 🥞 Konva draws only the drawing; everything else is HTML floating on top.                                                                                                                           |
| D145 | ✏️ Icons come from Lucide.                                                                                                                                                                          |
| D146 | ⌨️ Standard shortcuts through a small handler of our own (Cmd+Z, Shift+Cmd+Z, single letters for tools), listed in settings.                                                                        |
| D154 | 🔲 The select tool has three modes under one button: Arrow, Box select and Lasso select, with a dashed, marching outline while dragging.                                                            |
| D155 | 🗑️ Delete the selection with a trash button in the toolbar or the Delete and Backspace keys; a recognized letter goes with its ink.                                                                 |
| D157 | 🔄 Transform with handles on the selection: resize (Shift keeps proportions), rotate (snaps every 45°) and move, saved as one undoable `transform` event.                                           |
| D158 | 💬 The status reads "Claude is connected, not watching" when the bridge is up but Claude isn't waiting, and "Not connected to Claude" when there is no bridge.                                      |
| D159 | 🧭 The UI so far is a first draft (PR #84); next come its bugs and the handwriting ability.                                                                                                         |

## 🎛️ Modes

| ID   | decision                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D129 | 🎛️ Modes describe the moment, not separate apps: playing, learning, teaching, contributing; Claude picks one in auto, or you pick one by hand. |
| D138 | 📄 Each mode has a short instruction card for Claude, and in auto Claude switches through a tool call with a reason you can see and undo.      |
| D139 | 📦 The mode cards live in a built-in `modes` pack: knowledge, not code.                                                                        |

## 📜 Contract

| ID  | decision                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D79 | 📜 Contract v0: an event has `seq`, `t`, `who`, `type`, `target`, `detail`, `cause`; a scene object has `id`, `kind`, `label`, `pack`, `parts`, `relations`, `box`, `confidence`.                              |
| D76 | 📜 Claude reads meaning events by default; raw strokes only on request, per object.                                                                                                                            |
| D77 | 📜 Each read gives Claude only the events since its last read; the full scene on request.                                                                                                                      |
| D81 | 🔌 The MCP tools are generic: `open_canvas`, `get_events`, `get_scene`, `get_strokes`, `wait_for_event`, `act`, `say`, `ask`, `list_packs`, `install_pack`, `read_pack`, `write_pack`, plus `set_mode` (D138). |
| D25 | ⏳ Claude waits for you with `wait_for_event`, which answers only once something happens.                                                                                                                      |
| D88 | 🖊️ A stroke is `{ id, t0, tool, color, width, points }`, each point `[x, y, pressure, dt]` in world units, stored raw and never smoothed.                                                                      |
| D89 | 📏 Lines and crossings are scene objects, with `strokes` (the strokes that made them) and `geom` (a line's ends, a crossing's point).                                                                          |
| D95 | 🔷 A scene object can keep its exact outline as corners in `geom.poly`.                                                                                                                                        |
| D91 | ✏️ `act` takes 1–10 actions (`add`, `move`, `label`, `remove`) applied in order, all or nothing, by id and never by pixels; moving or removing your own drawing becomes a proposal.                            |
| D90 | 🔁 Every bridge message has one shape, `{ id, call, args }` back as `{ id, ok, result }` or an error; the browser owns the state and only Claude starts a call.                                                |

## ⚡ Fast Brain & comparator

| ID   | decision                                                                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D23  | ⚡ The Fast Brain is code, not an LLM.                                                                                                                                                                          |
| D60  | ⚡ The Fast Brain draws, listens, sends events, and asks Claude only when it must think.                                                                                                                        |
| D63  | 🌐 The Fast Brain lives in the browser.                                                                                                                                                                         |
| D24  | 🧭 Claude decides what to do; the Fast Brain works out the exact placement.                                                                                                                                     |
| D64  | 🧭 The comparator is the generic core of the Fast Brain: it recognizes what is drawn and keeps a scene description Claude reads.                                                                                |
| D96  | ✂️ Strokes are grouped into one symbol before anything is recognized, so an X is one symbol, not two lines.                                                                                                     |
| D97  | 🔤 Grouping works anywhere on the canvas; a group is read about 0.6 s after its last stroke, and every symbol shows a label with its score (line length changed by D109).                                       |
| D109 | 📏 A straight stroke of 400+ units is a line at once, for now.                                                                                                                                                  |
| D110 | ⏱️ A stroke that lands close by within 2 s rejoins the last symbol, and both are read again together.                                                                                                           |
| D167 | ⏱️ A stroke can join several recent words: every word read in the last 2 s counts, and a stroke that reaches more than one (an H's bar after its legs were read apart) merges them into one word. Extends D110. |
| D168 | 🔤 A lone letter the cards read clearly is a word (a one-letter `A`); a lone mark no card knows (an X) stays a symbol.                                                                                          |
| D169 | ⏱️ A written word waits 5 s for its next letter: a stroke beside it (closer than half its height) joins it within 5 s, not D110's 2 s. Writers pause between letters.                                           |

## ✍️ Handwriting ability (being built)

| ID   | decision                                                                                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D111 | ✍️ Handwriting reads each character by its structure (strokes, crossings, corners, loops), block capitals A–Z and digits 0–9 first; it is an ability, not a pack (changed by D161).                                                           |
| D112 | 🃏 A character card lists what a computer can check: stroke count, where lines meet or cross, angles, and closed loops.                                                                                                                       |
| D113 | 🏆 Each passing check on a card earns points, the best card wins with its score, and a low or near-tied score goes to Claude.                                                                                                                 |
| D114 | 📝 Word first, then letters: strokes close together form a word, and a clear gap starts the next letter.                                                                                                                                      |
| D115 | 🐢 When unsure, the Fast Brain shows `?` at once and sends Claude an event with its two best guesses and the word around it; Claude's answer replaces the label.                                                                              |
| D116 | 🖼️ Each letter gets a small label with its score, the word shows once above it, and you can tap a label to fix it.                                                                                                                            |
| D117 | 🔁 A letter you fix, or one Claude read that you leave, is saved as your own example, so the Fast Brain learns your writing.                                                                                                                  |
| D118 | 🧬 `$P` also matches your saved examples, keeping about the last 10 per letter.                                                                                                                                                               |
| D174 | 📊 Your examples live in a folder for the ability, `~/.visthinker/abilities/handwriting/examples.json`: label, raw strokes with their timing, who taught it and when. They name a letter first when one is sure; then the cards, then Claude. |
| D175 | 💬 You teach it in the chat: say "it's A", Claude labels the letter, and each letter is saved as an example. Handwriting is a core ability with its own storage.                                                                              |

## 🔌 Bridge & security

| ID   | decision                                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D82  | 🛡️ The bridge listens on localhost only, needs a secret token per session from the `open_canvas` link, checks the Origin, and allows one canvas per Claude session.    |
| D142 | 💾 Projects are saved on disk through the bridge, one folder per project in `~/.visthinker/projects`.                                                                  |
| D143 | ⚖️ How things look stays in the browser; how things behave goes on disk with the projects, where the bridge and Claude can read it.                                    |
| D134 | 👂 While a canvas is open, Claude stays in a listening loop so chat messages reach it at once (wording changed by D158).                                               |
| D151 | 📜 The MCP server gives Claude built-in instructions: listen on every event, react to drawing as much as to chat, and follow the mode's card (planned, not built yet). |
| D152 | 🎨 The canvas is the conversation: messages from the canvas are answered on the canvas.                                                                                |
| D153 | ⚡ A Quick or Thoughtful hint on the canvas tells Claude how long to think; the real model and effort stay in Claude Code (planned, not built yet).                    |

## 📦 Packs

| ID  | decision                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| D65 | 📦 Knowledge comes in packs: many files, any structure.                                                                             |
| D80 | 🧱 Packs are data: they wire tested building blocks and fill tables, and never ship code.                                           |
| D92 | 📁 A pack is a folder with `pack.json` (checked with Zod), `rules.json` and a `README.md` (the format gets redesigned later, D162). |
| D74 | 🧰 The app ships a small starter set of packs, so it works on its own.                                                              |
| D62 | 🔒 Published packs are read-only; you can copy and change them, or make your own, locally.                                          |
| D93 | 📁 Local packs live in `~/.visthinker/packs`, one folder per pack; `write_pack` writes there.                                       |
| D68 | 🔎 A drawing that matches a known pack can make the pack suggest itself (changed by D160: only the project starts it).              |

## ↩️ Undo & history

| ID   | decision                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------- |
| D78  | 📜 Undo is an event: the story only ever grows, so it is easy to replay and test.                       |
| D130 | ↩️ Undo covers only your own actions and never quietly removes something Claude did.                    |
| D133 | ↪️ Standard redo: it brings back what you just undid, and a new action ends the chain.                  |
| D132 | 🧹 Clear asks first, clears everything, and is one event, so a single undo brings it all back.          |
| D141 | 🧾 The contract has `redo` (pointing at the undo it cancels) and `clear` (hiding everything before it). |
| D131 | 🤝 Take back in a game left with tic-tac-toe (D162).                                                    |

## 🧰 Tooling & workflow

| ID   | decision                                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D83  | 🗂️ Feature modules with `index.ts` as the only door, a pure TypeScript core with ports (Renderer, Transport, PackSource, Clock), one-direction imports enforced by lint, and Zustand for UI state only. |
| D84  | 📦 pnpm workspaces (`packages/*`, `apps/*`); Turborepo only once a build or test run passes a minute.                                                                                                   |
| D87  | 🧪 Vitest and Playwright, ESLint and Prettier, and Zod schemas in `contract`.                                                                                                                           |
| D86  | 📜 `contract` will be published to npm as `@visthinker/contract`, released with Changesets (not yet).                                                                                                   |
| D56  | ⚙️ No WebAssembly for now.                                                                                                                                                                              |
| D94  | 🧪 The dry run was a throwaway prototype, never pushed; this repo starts at the real foundation.                                                                                                        |
| D85  | 🔓 This repo is public from its first commit.                                                                                                                                                           |
| D42  | 🛡️ `main` is protected: changes only through pull requests with passing tests, no force-push or delete.                                                                                                 |
| D99  | 🌿 A branch per task, named `type/short-name`; a release is a tag, not a branch.                                                                                                                        |
| D147 | 🌿 The first UI (T37–T50) went in one branch and one PR, a commit per task, as an exception to D99.                                                                                                     |
| D166 | 🌿 The handwriting ability is built and tested locally, a commit per step, and goes in as one PR only once it works end to end; an exception to D99, like D147.                                         |
| D100 | ✍️ Conventional Commits, squash merge only, and the PR title checked in CI.                                                                                                                             |
| D101 | 🤖 Commits keep Claude's `Co-Authored-By` line.                                                                                                                                                         |
| D102 | 🔀 Each PR follows a template (What, Why, How tested, Screenshot or GIF) and merges with passing CI after the diff is read.                                                                             |
| D103 | 🤖 CI on every PR and push to `main`: install, typecheck, lint, format, Vitest and build; Playwright on Chromium joins with the end-to-end tests.                                                       |
| D104 | 🐞 Each task gets a GitHub issue when work starts, closed by its PR, with labels `canvas`, `bridge`, `core`, `contract`, `packs`.                                                                       |
| D105 | 🏷️ Releases will follow semver through Changesets; the first one will be `v0.1.0`.                                                                                                                      |
| D106 | 🛡️ Repo settings: a ruleset on `main`, squash only, protected `v*` tags, secret scanning, Dependabot, a read-only `GITHUB_TOKEN`, and private vulnerability reporting.                                  |
| D98  | 🚪 The README is the front door: one screen with the tagline, a short GIF, what it does and a quick start; the GIF is always the newest one (D164).                                                     |
