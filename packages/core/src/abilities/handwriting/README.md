# ✍️ Handwriting ability

You write on the canvas and the Fast Brain reads it, letter by letter. When it isn't sure, Claude reads it. When you say what you wrote, it learns your hand. It's a core ability (D161 · D175), with its own data in [`data/`](data/) (D178). How the files fit together: [STRUCTURE.md](STRUCTURE.md).

## 🔁 How it reads a word

| #   | step                                                                                       | where                         |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------- |
| 1   | ✂️ strokes close in place and time are one word (D96, D97, D169)                           | `comparator/`                 |
| 2   | 🔤 the word splits into letters (D114)                                                     | `letters.ts`                  |
| 3   | 📐 each letter is measured: lines, curves, meets, crossings, loops                         | `features.ts`                 |
| 4   | 🏷️ each letter is named, in this order 👇                                                  | `read.ts`                     |
| 5   | 🖼️ the canvas shows `H 91%` under each letter, `B?` when unsure, and the word above (D116) | canvas `features/handwriting` |

## 🏷️ Who names a letter

| order | who                  | when                                                                                                                                   |
| ----- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 📊 **your examples** | your nearest saved example is within 1.0 and well ahead of the next letter (D174, D177, D181); tilted letters are turned back a little |
| 2     | 🃏 **the cards**     | no example is sure; or the cards clearly read a letter you never taught (D179). A reading that only wins turned is a guess (D180)      |
| 3     | 🤖 **Claude**        | neither is sure: the letter shows `?`, and Claude reads it with the word around it (D115)                                              |

## 💬 How you teach it

| #   | you or it                                                                           | in the story                     |
| --- | ----------------------------------------------------------------------------------- | -------------------------------- |
| 1   | ✏️ you write a letter or a word                                                     | `stroke`, `recognized`, `letter` |
| 2   | 💬 you say what it is in the chat: "it's A", "that says HELLO"                      | `message`                        |
| 3   | 🤖 Claude labels it with `act`                                                      | `label`                          |
| 4   | 📊 the Fast Brain saves each letter as an example, in order                         | `taught`                         |
| 5   | 💾 the bridge writes it to [`data/examples.json`](data/examples.json), one per line | a change in git                  |

- 🔢 Teach each letter about **3 times**, and each way you write it (a round B and an angular B are as far apart as two letters).
- 🧹 Only the newest **10 per letter** are kept (D118).
- ⭕ A circle is a shape until you teach an O like it: then round strokes like your O are letters, and a Q's tail joins its circle (D183).
- ∅ Say "that's not a letter" and Claude labels it `not a letter`: marks like it stay plain marks, outside any word (D182).
- 🌍 The repo is public, so your examples are too (D178).

## 🛠️ Try it

| run                                  | does                                                 |
| ------------------------------------ | ---------------------------------------------------- |
| `pnpm try:letters [project]`         | what it measures in the letters on a saved canvas    |
| `pnpm teach:letters <project> HELLO` | teaches the letters on a saved canvas, left to right |
