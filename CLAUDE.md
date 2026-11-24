# 🤖 Working in Visual Thinker

How an agent (or anyone) works in this repo. Product name: **Visual Thinker**. Package and code name: **`visthinker`**. Read [docs/architecture.md](docs/architecture.md) first, then [docs/decisions.md](docs/decisions.md).

## ⚡ Commands

| run            | does                                                             |
| -------------- | ---------------------------------------------------------------- |
| `pnpm install` | one install for the whole workspace (Node 24, pnpm)              |
| `pnpm dev`     | the canvas on its own, with fake ports                           |
| `pnpm test`    | Vitest, every package                                            |
| `pnpm check`   | typecheck, lint, format check, tests, build: run before every PR |
| `pnpm build`   | the canvas and the `visthinker` package                          |

## 🧱 Rules the code keeps

- **Imports go one way**: canvas → core → contract; the bridge uses only the contract (the canvas holds the state, D90); the `visthinker` package wraps the bridge. `eslint-plugin-boundaries` enforces it.
- **The core is pure TypeScript**: no React, no Konva, no Node. It talks to the world through ports (clock, renderer, transport, pack source).
- **The contract is the truth**: every event, object, stroke, tool and pack is a Zod schema in `packages/contract`. Change the schema first.
- **Canvas features meet only through their `index.ts`**. Zustand holds UI state only; the story holds what happened.
- **Konva draws only the drawing**; everything else is HTML on top (D144). Follow [docs/design-system.md](docs/design-system.md).
- **The story is append-only**. Undo, erase and transform are events too.
- **Claude acts by id, never pixels** (`act`, `say`, `ask`). Moving or removing the person's own drawing is a proposal they accept.
- **Security stays on**: localhost only, the session token, the Origin and Host checks, one tab. Never relax them.
- TypeScript runs with `erasableSyntaxOnly`: no parameter properties, no enums.
- Comments cite decisions by number (`D157`) where a choice needs its reason.

## 🌿 How work lands

1. 🎫 One task, one GitHub issue, titled `T12: …`.
2. 🌿 One branch per task: `type/short-name` (`feat/lasso-select`, `fix/stale-selection`).
3. ✍️ [Conventional Commits](https://www.conventionalcommits.org): `feat(canvas): …`, `fix(core): …`, `docs: …`. The PR title follows the same rule; CI checks it.
4. ✅ `pnpm check` passes before the PR. Tests for every change in behaviour.
5. 📝 The PR uses the template: What, Why (`Closes #12`), How tested, Screenshot or GIF.
6. 🔀 Squash-merged by the maintainer. Agents never merge.

Agent commits end with a `Co-Authored-By:` line naming the agent.

## 📖 Docs rules (D164)

- 🎞️ **A change you can see gets a GIF**: add it to `docs/images/changes/YYYY-MM-DD-what.gif` (under ~3 MB), add an entry at the top of [docs/changes.md](docs/changes.md), and put it at the top of the README.
- ✏️ **Drawings are two files** in `docs/drawings/`: `name.excalidraw` (the source) and `name.svg` (the export), kept in step.
- ⭐ **A new decision** goes in [docs/decisions.md](docs/decisions.md) with its number.
- 👤 **A story that changes** is updated in [docs/user-stories.md](docs/user-stories.md).
- Docs cover this repo only. Short, plain English, tables over paragraphs.
