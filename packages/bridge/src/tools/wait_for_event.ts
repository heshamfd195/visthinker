import { WAIT_GRACE_MS } from "@visthinker/contract";
import { relayTool } from "./types.ts";

export const waitForEvent = relayTool(
  "wait_for_event",
  "Wait until something happens on the canvas, e.g. the user taps a cell. Answers at once if matching unread events exist. Filter with types (event types) and who (user, fastbrain, claude). Returns all unread events and timedOut. timeoutMs defaults to 60000, max 300000.",
  (args) => args.timeoutMs + WAIT_GRACE_MS,
);
