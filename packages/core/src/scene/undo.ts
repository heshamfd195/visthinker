// Undo is an event (D78): the story keeps the original and adds an `undo` whose `cause`
// is the event it takes back. Nothing is ever deleted from the story.
import type { VisEvent } from "@visthinker/contract";
import type { Story } from "./story.ts";

/** User events that undo can take back. */
export const UNDOABLE = ["stroke", "mark"] as const;

/** The seqs of every event an `undo` has taken back. */
export function undoneSeqs(events: VisEvent[]): Set<number> {
  const undone = new Set<number>();
  for (const event of events) {
    if (event.type === "undo" && event.cause !== undefined) undone.add(event.cause);
  }
  return undone;
}

/** The latest user event that undo can still take back. */
export function findUndoable(events: VisEvent[]): VisEvent | undefined {
  const undone = undoneSeqs(events);
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    const undoable = (UNDOABLE as readonly string[]).includes(event.type);
    if (event.who === "user" && undoable && !undone.has(event.seq)) return event;
  }
  return undefined;
}

/** Appends an `undo` for the latest undoable user event, or returns undefined if there is none. */
export function undo(story: Story): VisEvent | undefined {
  const target = findUndoable(story.all());
  if (!target) return undefined;
  return story.append({
    who: "user",
    type: "undo",
    cause: target.seq,
    ...(target.target === undefined ? {} : { target: target.target }),
  });
}
