// Talking with Claude (D134 · D135): a message is an event Claude reads while it listens.
// Whatever is selected travels with it, so "what is this?" means exactly that selection.
import type { VisEvent } from "@visthinker/contract";
import type { History } from "./history.ts";
import type { Story } from "./story.ts";

export interface MessageInput {
  text: string;
  /** Ids of what was selected when the message was sent. */
  refs?: string[];
  /** The chat it belongs to, inside the project (D125). */
  chat?: string;
}

export function sendMessage(story: Story, input: MessageInput): VisEvent {
  const text = input.text.trim().slice(0, 2_000);
  if (!text) throw new Error("a message needs some text");
  return story.append({
    who: "user",
    type: "message",
    detail: {
      text,
      ...(input.refs?.length ? { refs: input.refs.slice(0, 20) } : {}),
      ...(input.chat ? { chat: input.chat } : {}),
    },
  });
}

/**
 * In a game, after Claude has answered, undo asks Claude for a take-back first (D131).
 * Returns the request, or undefined when undo can go ahead or a request is already waiting.
 */
export function requestTakeBack(story: Story, history: History): VisEvent | undefined {
  const pair = history.takeBack();
  if (!pair) return undefined;
  const events = story.all();
  const waiting = events.some(
    (e) =>
      e.type === "takeback" &&
      e.cause === pair.mine.seq &&
      !events.some((a) => a.type === "answer" && a.cause === e.seq),
  );
  if (waiting) return undefined;
  return story.append({
    who: "user",
    type: "takeback",
    cause: pair.mine.seq,
    ...(pair.mine.target ? { target: pair.mine.target } : {}),
    detail: { text: "Can I take back my move?", theirs: pair.theirs.seq },
  });
}
