# 🗂️ Handwriting ability: structure

What each file does, and the rules that keep it clean. What it does for you: [README.md](README.md).

## 📄 Files

| file                  | what it does                                                                                                                             | decisions        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `index.ts`            | 🚪 the only door: everything else in the core imports from here                                                                          |                  |
| `letters.ts`          | ✂️ splits a word into letters: strokes that overlap left to right, or sit in the same row, are one                                       | D114             |
| `features.ts`         | 📐 measures one letter: lines, curves (a rounded corner cut at its "knee"), meets, crossings, loops, as shares of its box                | D111, D112       |
| `cards.ts`            | 🃏 the character cards: what a computer can check for each capital (A, H, E, L, O so far)                                                | D112             |
| `scoring.ts`          | 🏆 scores every card against a letter; clear at 70+ and 15 ahead                                                                         | D113             |
| `examples.ts`         | 📊 the example book in memory (newest 10 per letter), and a letter turned into an example                                                | D117, D118, D174 |
| `match.ts`            | ⚡ the fast matcher: a prefilter, then `$P` on cached clouds, small turns when unsure; sure or unsure                                    | D118, D177       |
| `read.ts`             | 🔁 end to end: split, turn a tilted letter for the cards, measure, then name it (examples, cards, Claude)                                | D174, D179       |
| `words.ts`            | 💬 what it measured and who named it, in plain words for the events box and `pnpm try:letters`                                           | D116             |
| `*.test.ts`           | ✅ tests beside what they test, on real writing from `fixtures/`; `read.ts` is tested through `match.test.ts` and the comparator's tests |                  |
| `fixtures/hello.json` | 🧪 your real HELLOs, an A and two Bs, kept byte for byte for tests                                                                       |                  |
| `data/examples.json`  | 💾 your examples: label, strokes `[x, y, pressure, dt]` with each stroke's start, who taught it, when                                    | D172, D178       |

## 🔌 Outside this folder

| where                                       | what                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/contract/src/handwriting.ts`      | 📜 the schemas: features, readings, the `letter` and `taught` events                   |
| `packages/contract/src/examples.ts`         | 📜 the example and the examples file                                                   |
| `packages/core/src/comparator/`             | 🧠 groups strokes into words, calls `readHandwriting`, saves what Claude labels (D175) |
| `packages/bridge/src/abilities/examples.ts` | 💾 reads and writes `data/examples.json` for the canvas (D178)                         |
| `apps/canvas/src/features/handwriting/`     | 🖼️ the names under each letter and the debug view                                      |

## 🧱 Rules

- 🧠 **Pure TypeScript**: no React, no Konva, no Node, no disk. Time comes from the clock port.
- 📜 **Contract first**: a new field or event is a Zod schema in `packages/contract` before it's used here.
- 💾 **`data/` is written only by the bridge**, one example per line, so each letter you teach is one line in git. No code imports it.
- 📏 **Every tolerance is a named constant** (`MATCH`, `TILT`, `CLEAR_SCORE`…) with the reason it has its value, and the date it was measured.
- 🧪 **Tested on real writing**: change a constant and the tests say what it costs on `fixtures/`.
- 🔢 **Comments cite decisions** by number where a choice needs its reason.
