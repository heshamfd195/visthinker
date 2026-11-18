import { relayTool } from "./types.ts";

export const getScene = relayTool(
  "get_scene",
  "Get the full current scene: every object on the canvas with its id, kind, label, relations and box. Use the ids with act.",
);
