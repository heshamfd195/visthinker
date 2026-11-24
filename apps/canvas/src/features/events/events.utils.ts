// The events box in plain words (D127): every story event and every Claude call as one short
// line, raw JSON only on a click.
import { LetterEventDetail, type VisEvent } from "@visthinker/contract";
import { letterBreakdown, letterSummary, type CallRecord } from "@visthinker/core";

export type EventsFilter = "all" | "you" | "claude" | "read" | "problems";

export const FILTERS: readonly { value: EventsFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "you", label: "You" },
  { value: "claude", label: "Claude" },
  { value: "read", label: "Read" },
  { value: "problems", label: "Problems" },
];

/** Below this a reading counts as unsure, so it shows under Problems. */
export const LOW_CONFIDENCE = 0.6;

/** One line of the box: a story event or a Claude tool call. */
export type Row =
  | { kind: "event"; key: string; at: number; event: VisEvent }
  | { kind: "call"; key: string; at: number; call: CallRecord };

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const pct = (score: number) => `${Math.round(score * 100)}%`;
const quote = (text: string, max = 80) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

const SPEAKER: Record<VisEvent["who"], string> = {
  user: "you",
  claude: "Claude",
  fastbrain: "Fast Brain",
  api: "API",
};

/** "near c5" or "inside b1", from a move or place detail. */
function where(d: Record<string, unknown>): string | undefined {
  const near = str(d["near"]);
  if (near) return `near ${near}`;
  const inside = str(d["inside"]);
  return inside ? `inside ${inside}` : undefined;
}

const join = (...bits: (string | undefined | false)[]) => bits.filter(Boolean).join(" · ");

/** Claude's change, made directly or through `act` (the Fast Brain applies it, naming Claude in `by`). */
const byClaude = (e: VisEvent) => e.who === "claude" || e.detail?.["by"] === "claude";

/** What an event says, in plain words: "stroke s14", "read X · y3 · 92%", "you said: …". */
export function describe(e: VisEvent): string {
  const d = e.detail ?? {};
  const who = SPEAKER[e.who];
  const text = str(d["text"]);
  switch (e.type) {
    case "stroke":
      return `stroke ${e.target ?? ""}`.trim();
    case "recognized": {
      const kind = str(d["kind"]) ?? "something";
      if (kind !== "symbol") return join(`read ${kind}`, e.target);
      const label = str(d["label"]);
      const score = num(d["score"]);
      if (!label || label === "?") return join("couldn't read", e.target);
      return join(`read ${label}`, e.target, score !== undefined && pct(score));
    }
    case "letter": {
      // One letter of a word, with what the handwriting ability measured (T51).
      const letter = LetterEventDetail.safeParse(d);
      if (!letter.success) return join("letter", e.target);
      const { index, of, features } = letter.data;
      return join(`letter ${index} of ${of}`, e.target, letterSummary(features));
    }
    case "place": {
      const kind = str(d["kind"]) ?? "object";
      return join(`placed ${kind}`, e.target, where(d), byClaude(e) && "by Claude");
    }
    case "move":
      return join(`moved ${e.target ?? ""}`.trim(), where(d), byClaude(e) && "by Claude");
    case "label":
      return join(`labelled ${e.target ?? ""}`.trim(), text && `“${quote(text)}”`);
    case "remove": {
      // Two words the Fast Brain read apart, joined by a later stroke (D110).
      const into = str(d["into"]);
      if (into && e.who === "fastbrain") return `merged ${e.target ?? ""} into ${into}`;
      return join(`removed ${e.target ?? ""}`.trim(), e.who !== "user" && `by ${who}`);
    }
    case "undo":
    case "redo":
      return join(
        `${e.type === "undo" ? "undid" : "redid"} ${e.cause !== undefined ? `#${e.cause}` : ""}`.trim(),
        e.target,
        e.who !== "user" && `by ${who}`,
      );
    case "clear":
      return "cleared the canvas";
    case "say":
      return `${who} said: ${quote(text ?? "")}`;
    case "ask":
      return `${who} asked: ${quote(text ?? "")}`;
    case "answer": {
      const choice = str(d["choice"]) ?? "";
      if (e.who === "user")
        return join(`you answered: ${choice}`, e.cause !== undefined && `#${e.cause}`);
      const verdict = choice === "yes" ? "agreed" : choice === "no" ? "declined" : choice;
      return `${who} ${verdict}${text ? `: ${quote(text)}` : ""}`;
    }
    case "message": {
      const refs = Array.isArray(d["refs"]) ? (d["refs"] as unknown[]).map(String) : [];
      return join(`you said: ${quote(text ?? "")}`, refs.length > 0 && `with ${refs.join(", ")}`);
    }
    case "propose": {
      const { op, ...rest } = d as { op?: unknown } & Record<string, unknown>;
      return join(
        `Claude proposed: ${str(op) ?? "a change"} ${e.target ?? ""}`.trim(),
        where(rest),
      );
    }
    case "pack":
      return join(
        `pack ${str(d["name"]) ?? ""}`.trim(),
        str(d["version"]),
        d["by"] === "claude" && "by Claude",
      );
    case "mode": {
      const mode = str(d["mode"]) ?? "auto";
      return join(
        `mode → ${mode}`,
        d["manual"] === true ? "by hand" : `by ${who}`,
        str(d["reason"]),
      );
    }
    case "end": {
      const winner = d["winner"];
      return winner === "user"
        ? "game over · you win"
        : winner === "claude"
          ? "game over · Claude wins"
          : "game over · draw";
    }
    default:
      return join(e.type, e.target, text && `“${quote(text)}”`);
  }
}

/** A Claude tool call: "Claude · get_scene 0.3 s", with ✗ when it failed. */
export function describeCall(c: CallRecord): string {
  return `Claude · ${c.call} ${seconds(c.ms)}${c.ok ? "" : " ✗"}`;
}

/** "0.3 s", one decimal. */
export function seconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
}

/** Session-clock time as mm:ss; past an hour the minutes keep counting. */
export function mmss(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Unsure, low-confidence or failed (the Problems chip). */
export function isProblem(row: Row): boolean {
  if (row.kind === "call") return !row.call.ok;
  const d = row.event.detail ?? {};
  if (d["error"] !== undefined) return true;
  if (row.event.type !== "recognized") return false;
  const score = num(d["score"]);
  return d["label"] === "?" || (score !== undefined && score < LOW_CONFIDENCE);
}

const READ_TYPES = new Set(["recognized", "letter", "place"]);

/** Whether a row shows under a filter chip. */
export function matches(row: Row, filter: EventsFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "you":
      return row.kind === "event" && row.event.who === "user";
    case "claude":
      return row.kind === "call" || row.event.who === "claude";
    case "read":
      return (
        row.kind === "event" && row.event.who === "fastbrain" && READ_TYPES.has(row.event.type)
      );
    case "problems":
      return isProblem(row);
  }
}

/** Story events and Claude's calls in one time order; on a tie the event comes first. */
export function mergeRows(events: readonly VisEvent[], calls: readonly CallRecord[]): Row[] {
  const rows: Row[] = [
    ...events.map((event): Row => ({ kind: "event", key: `e${event.seq}`, at: event.t, event })),
    ...calls.map((call, i): Row => ({ kind: "call", key: `c${i}`, at: call.at, call })),
  ];
  // A stable sort keeps the story's own order among events at the same time.
  return rows.sort((a, b) => a.at - b.at || (a.kind === b.kind ? 0 : a.kind === "event" ? -1 : 1));
}

/** The row's line in plain words. */
export function rowText(row: Row): string {
  return row.kind === "call" ? describeCall(row.call) : describe(row.event);
}

/** What the row points at on the canvas, if anything (D127). */
export function rowTarget(row: Row): string | undefined {
  return row.kind === "event" ? row.event.target : undefined;
}

/** The raw JSON shown under a clicked row. */
export function rowJson(row: Row): string {
  return JSON.stringify(row.kind === "call" ? row.call : row.event, null, 2);
}

/** What a clicked row opens to: a letter's measurements in plain words, then the raw JSON. */
export function rowDetail(row: Row): string {
  if (row.kind === "event" && row.event.type === "letter") {
    const letter = LetterEventDetail.safeParse(row.event.detail);
    if (letter.success)
      return `${letterBreakdown(letter.data.features).join("\n")}\n\n${rowJson(row)}`;
  }
  return rowJson(row);
}

/**
 * What Claude is doing, for the pill and the header. "away": connected, but not waiting on the
 * canvas right now (Claude Code works in turns); "offline": no bridge at all.
 */
export type Status = "listening" | "thinking" | "away" | "offline";

export function status(
  listening: boolean,
  thinkingSince: number | undefined,
  connected = true,
): Status {
  if (!connected) return "offline";
  if (thinkingSince !== undefined) return "thinking";
  return listening ? "listening" : "away";
}

export function statusText(s: Status, thinkingFor = 0): string {
  if (s === "thinking") return `Claude is thinking… ${seconds(thinkingFor)}`;
  if (s === "offline") return "Not connected to Claude";
  return s === "listening" ? "Claude is listening" : "Claude is connected, not watching";
}
