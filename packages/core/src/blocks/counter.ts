// The `counter` block (D80): counts objects of a kind in the scene, optionally with one label,
// against an optional limit. A pack wires it for things like "the game ends after 9 marks" or
// "score the O marks".
import type { CounterRules, SceneObject } from "@visthinker/contract";

export interface Count {
  count: number;
  /** True once a limit is set and the count has reached it. */
  reached: boolean;
}

export function countIn(rules: CounterRules, objects: readonly SceneObject[]): Count {
  const count = objects.filter(
    (o) => o.kind === rules.of && (rules.label === undefined || o.label === rules.label),
  ).length;
  return { count, reached: rules.limit !== undefined && count >= rules.limit };
}
