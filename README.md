<div align="center">

# Visthinker

**Interact, play, learn and contribute.**

A shared canvas where Claude sees your drawing as data, not pixels.

[![CI](https://github.com/heshamfd195/visthinker/actions/workflows/ci.yml/badge.svg)](https://github.com/heshamfd195/visthinker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

> 🚧 **Early days.** Visthinker is being built in the open toward its first release, `v0.1.0`. The demo GIF arrives with it.

## What it is

You draw on a canvas, and every stroke, shape and tap reaches Claude as structured events instead of a screenshot. Claude understands what you drew and answers on the same canvas. Next up: handwriting, so you and Claude can write to each other.

## Try it

The canvas runs on its own today. You need Node 24 and pnpm.

```bash
pnpm install
pnpm dev
```

Then open the address it prints. Draw with the pen, or place boxes, circles and arrows from the toolbar, and watch each one arrive as an event in the story panel.

## Play with Claude

Once the `visthinker` package is on npm, adding it to Claude Code is one line:

```bash
claude mcp add visthinker -- npx visthinker
```

It isn't published yet. Until then, build it from this repo and point Claude Code at the built file:

```bash
pnpm install && pnpm build
```

```bash
claude mcp add visthinker -- node "$PWD/packages/visthinker/dist/visthinker.js"
```

Then ask Claude to open the canvas, draw something, and talk about it in the chat.

## How it works

| part        | what it does                                                                                                                           | status         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 🖼️ Canvas   | React + Konva in your browser: ink, shapes, arrows, the live story                                                                     | ✅ working     |
| 📜 Contract | the shared shapes: events, scene objects, strokes, MCP tools, packs                                                                    | ✅ working     |
| 🧠 Core     | pure TypeScript: the event story, the scene, the game blocks and packs; the recognizer that turns strokes into lines and cells is next | 🚧 in progress |
| 🔌 Bridge   | a local MCP server that connects the canvas to Claude Code                                                                             | ✅ working     |
| 📦 Packs    | games and knowledge as small data packs, not code changes                                                                              | ✅ working     |

## Layout

```
packages/contract   the shared shapes, as Zod schemas
packages/core       the Fast Brain: no React, no Konva, no Node
packages/bridge     the MCP server
packages/visthinker the npm package: the bridge bundled with the canvas and packs
apps/canvas         the React + Konva app
packs/              the starter packs: shapes, modes
```

Imports go one way: the canvas uses the core, and the core uses only the contract. Lint enforces it.

## Open core

The app runs fully on your machine and is open source under the MIT licence. An optional hosted API adds more later, and you can plug in your own.

## License

[MIT](LICENSE)
