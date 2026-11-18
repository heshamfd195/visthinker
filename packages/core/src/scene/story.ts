// The story (D78): an append-only list of events. `seq` starts at 1 and is never reused.
// A read cursor gives Claude only the events since its last read (D77).
import type { VisEvent } from "@visthinker/contract";
import type { Clock } from "../ports/index.ts";

/** An event before the story numbers and timestamps it. */
export type NewEvent = Omit<VisEvent, "seq" | "t">;

export interface Story {
  append(event: NewEvent): VisEvent;
  all(): VisEvent[];
  get(seq: number): VisEvent | undefined;
  /** Events after the read cursor, without moving it. */
  unread(): VisEvent[];
  /** Events after the read cursor; moves the cursor to the end. */
  read(): VisEvent[];
  /** Called with each new event. Returns an unsubscribe function. */
  subscribe(listener: (event: VisEvent) => void): () => void;
}

/** `initial`: the events of a saved project (D142); Claude's read cursor starts after them. */
export function createStory(clock: Clock, initial: readonly VisEvent[] = []): Story {
  const events: VisEvent[] = initial.map((e) => structuredClone(e));
  events.forEach((e, i) => {
    if (e.seq !== i + 1) throw new Error(`saved event ${i + 1} has seq ${e.seq}`);
  });
  const listeners = new Set<(event: VisEvent) => void>();
  let readUpTo = events.length;

  // Copies in and out: nothing outside can change what the story holds.
  const copy = (event: VisEvent): VisEvent => structuredClone(event);

  return {
    append(event) {
      if (event.cause !== undefined && event.cause > events.length) {
        throw new Error(`cause ${event.cause} is not an earlier event`);
      }
      const full: VisEvent = { seq: events.length + 1, t: clock.now(), ...dropUndefined(event) };
      events.push(copy(full));
      for (const listener of [...listeners]) listener(copy(full));
      return full;
    },
    all: () => events.map(copy),
    get(seq) {
      const event = events[seq - 1];
      return event && copy(event);
    },
    unread: () => events.slice(readUpTo).map(copy),
    read() {
      const out = events.slice(readUpTo).map(copy);
      readUpTo = events.length;
      return out;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function dropUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
