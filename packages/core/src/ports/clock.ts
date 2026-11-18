// The Clock port: the core never reads the wall clock or sets a timer itself, so tests control
// time. The real clock is an adapter in the app.

/** The session clock: milliseconds since the session started, plus a timer. */
export interface Clock {
  now(): number;
  /** Runs `fn` once after `ms`. Returns a function that cancels it. */
  after(ms: number, fn: () => void): () => void;
}

/** A clock for tests: time moves, and timers fire, only when `advance` is called. */
export interface ManualClock extends Clock {
  advance(ms: number): void;
}

export function createManualClock(start = 0): ManualClock {
  let time = start;
  let nextId = 0;
  const timers = new Map<number, { due: number; fn: () => void }>();
  return {
    now: () => time,
    after(ms, fn) {
      const id = nextId++;
      timers.set(id, { due: time + Math.max(0, ms), fn });
      return () => {
        timers.delete(id);
      };
    },
    advance(ms) {
      if (ms < 0) throw new Error("time only moves forward");
      const until = time + ms;
      // Fire due timers in time order, each at its own moment.
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.due <= until)
          .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!due) break;
        timers.delete(due[0]);
        time = due[1].due;
        due[1].fn();
      }
      time = until;
    },
  };
}
