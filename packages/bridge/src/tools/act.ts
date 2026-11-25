import { relayTool } from "./types.ts";

export const act = relayTool(
  "act",
  "Change the canvas by object id, never pixels: 1 to 10 actions (add, move, label, remove), applied in order, all or nothing. Example: label y3 as A: { actions: [{ op: 'label', target: 'y3', detail: { text: 'A' } }] }. The canvas decides where things go; moving or removing the person's own drawing becomes a proposal they accept. Labelling a handwritten word or mark teaches the handwriting ability (D175): when the person tells you what they wrote (\"it's A\", \"that says HELLO\"), label it with exactly those letters, one per letter in the word, and each letter is saved as an example, so the canvas reads it alone next time. A `taught` event says what was saved, or why not.",
);
