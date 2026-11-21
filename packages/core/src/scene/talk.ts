// Talking with Claude (D134 · D135): a message is an event Claude reads while it listens.
// Whatever is selected travels with it, so "what is this?" means exactly that selection.
import type { VisEvent } from "@visthinker/contract";
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
