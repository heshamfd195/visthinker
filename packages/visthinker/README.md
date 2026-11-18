# visthinker

A shared canvas where Claude sees your drawing as data, not pixels. **Interact, play, learn and contribute.**

## Add it to Claude Code

```bash
claude mcp add visthinker -- npx visthinker
```

Then ask Claude to open the canvas. You draw, place shapes or play a game, and Claude reads every stroke, shape and tap as structured events, and answers on the same canvas.

## What's inside

One command that runs the Visthinker bridge, a local MCP server. It serves the canvas on `127.0.0.1` only, with a secret token per session and one canvas tab per Claude session. Packs you or Claude write are saved in `~/.visthinker/packs`.

Source and docs: [github.com/heshamfd195/visthinker](https://github.com/heshamfd195/visthinker). MIT licence.
