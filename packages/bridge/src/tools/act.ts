import { relayTool } from "./types.ts";

export const act = relayTool(
  "act",
  "Change the canvas by object id, never pixels: 1 to 10 actions (add, move, mark, label, remove), applied in order, all or nothing. Example: mark cell c5 with O: { actions: [{ op: 'mark', target: 'c5', detail: { shape: 'O' } }] }. The canvas decides where things go and refuses moves that break the pack's rules.",
);
