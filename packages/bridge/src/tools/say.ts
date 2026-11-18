import { relayTool } from "./types.ts";

export const say = relayTool(
  "say",
  "Show a short message to the user on the canvas, optionally next to an object (target id).",
);
