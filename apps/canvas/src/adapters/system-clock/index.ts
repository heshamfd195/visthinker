// The real Clock: milliseconds since this page's session started.
import type { Clock } from "@visthinker/core";

export function createSystemClock(now: () => number = () => performance.now()): Clock {
  const started = now();
  return { now: () => Math.round(now() - started) };
}
