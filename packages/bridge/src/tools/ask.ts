import { relayTool } from "./types.ts";

export const ask = relayTool(
  "ask",
  "Ask the user a question on the canvas, optionally with up to 6 choices. Returns the ask's seq; the reply arrives later as an answer event whose cause is that seq (use wait_for_event).",
);
