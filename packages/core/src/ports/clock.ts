// The Clock port: the core never reads the wall clock itself, so tests control time.
// The real clock is an adapter in the app.

/** The session clock: milliseconds since the session started. */
export interface Clock {
  now(): number;
}

/** A clock for tests: time moves only when `advance` is called. */
export interface ManualClock extends Clock {
  advance(ms: number): void;
}

export function createManualClock(start = 0): ManualClock {
  let time = start;
  return {
    now: () => time,
    advance(ms) {
      if (ms < 0) throw new Error("time only moves forward");
      time += ms;
    },
  };
}
