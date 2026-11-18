import { relayTool } from "./types.ts";

export const getStrokes = relayTool(
  "get_strokes",
  "Get the raw strokes (points) of one object or stroke id. Only needed when the scene is not enough.",
);
