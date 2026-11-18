import { relayTool } from "./types.ts";

export const getEvents = relayTool(
  "get_events",
  "Get the events on the canvas since your last read (strokes, taps, marks, recognized shapes, answers). Each read returns only new events.",
);
