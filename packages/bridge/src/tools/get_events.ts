import { relayTool } from "./types.ts";

export const getEvents = relayTool(
  "get_events",
  "Get the events on the canvas since your last read (strokes, recognized shapes, symbols and written words, `letter` events with what each handwritten letter measured, messages, answers). Each read returns only new events.",
);
