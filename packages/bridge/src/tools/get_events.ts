import { relayTool } from "./types.ts";

export const getEvents = relayTool(
  "get_events",
  "Get the events on the canvas since your last read (strokes, recognized shapes and symbols, messages, answers). Each read returns only new events.",
);
