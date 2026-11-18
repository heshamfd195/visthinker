import { comingTool } from "./types.ts";

export const openCanvas = comingTool(
  "open_canvas",
  "Open the shared Visthinker canvas in the user's browser and return its link. Call it first, and once. The other canvas tools answer no_canvas until the tab has connected.",
  "T17",
);
