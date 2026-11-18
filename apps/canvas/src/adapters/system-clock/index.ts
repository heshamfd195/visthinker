// The real Clock: milliseconds since this page's session started, and the browser's timers.
import type { Clock } from "@visthinker/core";

export function createSystemClock(now: () => number = () => performance.now()): Clock {
  const started = now();
  return {
    now: () => Math.round(now() - started),
    after(ms, fn) {
      const timer = setTimeout(fn, ms);
      return () => clearTimeout(timer);
    },
  };
}
