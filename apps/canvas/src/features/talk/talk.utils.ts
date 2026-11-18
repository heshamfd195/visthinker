import type { VisEvent } from "@visthinker/contract";

/** Claude's latest message (a `say`, an `ask` with choices, a proposal) or the game's end. */
export interface Message {
  seq: number;
  kind: "say" | "ask" | "propose" | "end";
  text: string;
  /** Empty once answered, and for a `say`. */
  choices: string[];
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** "move b1 near c5" or "remove b1", for a proposal. */
function proposalText(e: VisEvent): string {
  const { op, ...rest } = (e.detail ?? {}) as { op?: string } & Record<string, unknown>;
  const where = Object.entries(rest).map(([k, v]) => `${k} ${String(v)}`)[0];
  return `Claude suggests: ${[op, e.target, where].filter(Boolean).join(" ")}`;
}

/**
 * The message the strip shows, read from the story. `clicked` holds the seqs already answered
 * here, so the buttons go at once, before the answer event comes back.
 */
export function messageFromStory(
  events: VisEvent[],
  clicked: ReadonlySet<number> = new Set(),
): Message | null {
  const answered = new Set(clicked);
  for (const e of events) if (e.type === "answer" && e.cause !== undefined) answered.add(e.cause);
  let message: Message | null = null;
  for (const e of events) {
    if (e.type === "end") {
      const winner = e.detail?.["winner"];
      const text =
        winner === "user" ? "You win! 🎉" : winner === "claude" ? "Claude wins." : "It's a draw.";
      message = { seq: e.seq, kind: "end", text, choices: [] };
      continue;
    }
    if (e.who !== "claude") continue;
    const text = typeof e.detail?.["text"] === "string" ? (e.detail["text"] as string) : "";
    if (e.type === "say" && text) message = { seq: e.seq, kind: "say", text, choices: [] };
    else if (e.type === "ask" && text) {
      message = {
        seq: e.seq,
        kind: "ask",
        text,
        choices: answered.has(e.seq) ? [] : strings(e.detail?.["choices"]),
      };
    } else if (e.type === "propose") {
      message = {
        seq: e.seq,
        kind: "propose",
        text: proposalText(e),
        choices: answered.has(e.seq) ? [] : ["accept", "decline"],
      };
    }
  }
  return message;
}

/** The cells of the winning line of the last game that ended with one. */
export function winningLine(events: VisEvent[]): Set<string> {
  const end = [...events].reverse().find((e) => e.type === "end");
  const line = end?.detail?.["line"];
  return new Set(Array.isArray(line) ? line.filter((c): c is string => typeof c === "string") : []);
}
