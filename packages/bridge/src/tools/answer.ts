import { relayTool } from "./types.ts";

export const answer = relayTool(
  "answer",
  "Answer a request the person made of you, such as a take-back (a takeback event): cause is the request's seq, accept says yes or no, text is an optional short reply. Accepting a take-back undoes your last move and theirs.",
);
