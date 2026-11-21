import { relayTool } from "./types.ts";

export const setMode = relayTool(
  "set_mode",
  "Switch the canvas mode (playing, learning, teaching, contributing) when the moment changes, with a short reason the person sees, e.g. 'you asked me to explain'. Returns the mode's instruction card: follow it. Refused while the person has picked a mode by hand.",
);
