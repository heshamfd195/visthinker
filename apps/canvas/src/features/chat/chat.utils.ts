// The chat with Claude (T43 · T44): the thread read from the story, and where reply dots go.
import type { SceneObject, VisEvent } from "@visthinker/contract";

/** One line of the thread. */
export type ThreadItem =
  | {
      kind: "claude";
      seq: number;
      /** Claude, or the Fast Brain asking about a drawing (D68). */
      from: "claude" | "fastbrain";
      text: string;
      target?: string;
      /** An ask's choices; empty for a say and once answered. */
      choices: string[];
      /** The choice picked, once an ask is answered. */
      answer?: string;
    }
  | { kind: "you"; seq: number; text: string; refs: string[]; target?: string }
  | {
      kind: "propose";
      seq: number;
      text: string;
      target?: string;
      answered: boolean;
      answer?: string;
    };

const THREAD_TYPES = new Set(["say", "ask", "message", "propose"]);

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Events of this chat: those that name it, and those that name none (D125). */
export function inChat(e: VisEvent, chat: string): boolean {
  const c = e.detail?.["chat"];
  return c === undefined || c === chat;
}

/** The choice picked for an ask or a proposal, from the `answer` whose cause is its seq. */
export function answerOf(events: readonly VisEvent[], seq: number): string | undefined {
  const a = events.find((e) => e.type === "answer" && e.cause === seq);
  return a ? (str(a.detail?.["choice"]) ?? "") : undefined;
}

export function isAnswered(events: readonly VisEvent[], seq: number): boolean {
  return answerOf(events, seq) !== undefined;
}

/** "Proposed: move b1 near c5", for a `propose` (matches the old strip's wording). */
export function proposalText(e: VisEvent): string {
  const { op, ...rest } = (e.detail ?? {}) as { op?: unknown } & Record<string, unknown>;
  const where = Object.entries(rest).map(([k, v]) => `${k} ${String(v)}`)[0];
  return `Proposed: ${[str(op), e.target, where].filter(Boolean).join(" ")}`;
}

/**
 * The thread of one chat. A person's answer to an ask or proposal folds into it rather than
 * standing alone; `clicked` holds answers given here that the story hasn't echoed yet.
 */
export function threadFor(
  events: readonly VisEvent[],
  chat: string,
  clicked: ReadonlyMap<number, string> = new Map(),
): ThreadItem[] {
  const answers = new Map(clicked);
  for (const e of events) {
    if (e.type === "answer" && e.who === "user" && e.cause !== undefined) {
      answers.set(e.cause, str(e.detail?.["choice"]) ?? "");
    }
  }
  const items: ThreadItem[] = [];
  for (const e of events) {
    if (!THREAD_TYPES.has(e.type) || !inChat(e, chat)) continue;
    const text = str(e.detail?.["text"]);
    const target = e.target ? { target: e.target } : {};
    switch (e.type) {
      case "say":
      case "ask": {
        if ((e.who !== "claude" && e.who !== "fastbrain") || !text) break;
        const answer = answers.get(e.seq);
        items.push({
          kind: "claude",
          seq: e.seq,
          from: e.who,
          text,
          ...target,
          choices: e.type === "ask" && answer === undefined ? strings(e.detail?.["choices"]) : [],
          ...(answer !== undefined ? { answer } : {}),
        });
        break;
      }
      case "message":
        if (text)
          items.push({
            kind: "you",
            seq: e.seq,
            text,
            refs: strings(e.detail?.["refs"]),
            ...target,
          });
        break;
      case "propose": {
        const answer = answers.get(e.seq);
        items.push({
          kind: "propose",
          seq: e.seq,
          text: proposalText(e),
          ...target,
          answered: answer !== undefined,
          ...(answer !== undefined ? { answer } : {}),
        });
        break;
      }
    }
  }
  return items;
}

/** Claude's (or the Fast Brain's) latest say or ask in this chat, cut to `max` characters. */
export function lastClaudeWords(
  events: readonly VisEvent[],
  chat: string,
  max = 120,
): string | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type !== "say" && e.type !== "ask") continue;
    if (e.who !== "claude" && e.who !== "fastbrain") continue;
    if (!inChat(e, chat)) continue;
    const text = str(e.detail?.["text"]);
    if (text) return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  }
  return undefined;
}

/** The status line above the input (D134). */
export function chatStatus(listening: boolean, connected: boolean): string {
  if (!connected) return "Not connected to Claude";
  return listening
    ? "Claude is listening"
    : "Claude is connected, not watching. Your message will wait";
}

export interface Dot {
  seq: number;
  target: string;
  x: number;
  y: number;
}

/**
 * Reply dots (D136): one per object Claude said something about, at its box's top-right
 * corner, linked to the latest such message.
 */
export function dotsFor(events: readonly VisEvent[], objects: readonly SceneObject[]): Dot[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const latest = new Map<string, number>();
  for (const e of events) {
    if (e.type === "say" && e.who === "claude" && e.target && byId.has(e.target)) {
      latest.set(e.target, e.seq);
    }
  }
  return [...latest].map(([target, seq]) => {
    const [x, y, w] = byId.get(target)!.box;
    return { seq, target, x: x + w, y };
  });
}
