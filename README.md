<div align="center">

# Visthinker

**Interact, play, learn and contribute.**

A shared canvas where Claude sees your drawing as data, not pixels.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

> 🚧 **Early days.** Visthinker is being built in the open toward its first release, `v0.1.0`. The demo GIF and quick start arrive with it.

## What it is

You draw on a canvas, and every stroke, line and tap reaches Claude as structured events instead of a screenshot. Claude understands what you drew and answers on the same canvas. The first game is tic-tac-toe: you draw the grid, you play X, Claude plays O.

## How it works

- 🖼️ **Canvas:** a React + Konva app in your browser.
- 🧠 **Core:** a pure TypeScript engine that turns strokes into shapes, lines and cells.
- 🔌 **Bridge:** a local MCP server that connects the canvas to Claude Code.
- 📦 **Packs:** games and knowledge come as small data packs, not code changes.

## Open core

The app runs fully on your machine and is open source under the MIT licence. An optional hosted API adds more later, and you can plug in your own.

## License

[MIT](LICENSE)
