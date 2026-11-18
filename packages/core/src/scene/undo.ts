// Undo is an event (D78): the story keeps the original and adds an `undo` whose `cause`
// is the event it takes back. A `redo` points at the undo it cancels (D141). Nothing is ever
// deleted from the story. These helpers read the story; `history.ts` also changes the scene.
import type { VisEvent } from "@visthinker/contract";
import type { Story } from "./story.ts";

/** User events that undo can take back (D130 · D132). */
export const UNDOABLE = ["stroke", "mark", "place", "move", "clear"] as const;

/** The undos a later `redo` has cancelled. */
export function redoneUndos(events: VisEvent[]): Set<number> {
  const redone = new Set<number>();
  for (const event of events) {
    if (event.type === "redo" && event.cause !== undefined) redone.add(event.cause);
  }
  return redone;
}

/** The seqs of every event an undo has taken back and no redo has brought back. */
export function undoneSeqs(events: VisEvent[]): Set<number> {
  const redone = redoneUndos(events);
  const undone = new Set<number>();
  for (const event of events) {
    if (event.type !== "undo" || event.cause === undefined || redone.has(event.seq)) continue;
    undone.add(event.cause);
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

/**
 * The user's latest undo that redo can bring back. A new action of theirs after it ends the
 * redo chain (D133).
 */
export function findRedoable(events: VisEvent[]): VisEvent | undefined {
  const redone = redoneUndos(events);
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (event.who !== "user" || event.type === "redo") continue;
    if (event.type === "undo") {
      if (!redone.has(event.seq)) return event;
      continue;
    }
    if ((UNDOABLE as readonly string[]).includes(event.type)) return undefined;
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
