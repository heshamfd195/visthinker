import { VisEvent } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import { createStory } from "./index.ts";

describe("story (D77 · D78)", () => {
  it("numbers events from 1, stamps them from the clock, and every event fits the contract", () => {
    const clock = createManualClock();
    const story = createStory(clock);
    const a = story.append({ who: "user", type: "stroke", target: "s1" });
    clock.advance(250);
    const b = story.append({ who: "fastbrain", type: "recognized", target: "l1", cause: a.seq });
    expect([a.seq, b.seq]).toEqual([1, 2]);
    expect([a.t, b.t]).toEqual([0, 250]);
    for (const event of story.all()) expect(VisEvent.parse(event)).toEqual(event);
  });

  it("gives only the new events since the last read", () => {
    const story = createStory(createManualClock());
    story.append({ who: "user", type: "stroke" });
    expect(story.read()).toHaveLength(1);
    expect(story.read()).toHaveLength(0);
    story.append({ who: "claude", type: "say" });
    expect(story.unread()).toHaveLength(1);
    expect(story.read().map((e) => e.seq)).toEqual([2]);
  });

  it("hands out copies, so nothing outside can change the story", () => {
    const story = createStory(createManualClock());
    const event = story.append({ who: "user", type: "stroke", detail: { points: 3 } });
    event.detail!.points = 99;
    story.all()[0]!.detail!.points = 42;
    expect(story.get(1)?.detail).toEqual({ points: 3 });
  });

  it("refuses a cause that isn't an earlier event", () => {
    const story = createStory(createManualClock());
    story.append({ who: "user", type: "stroke" });
    expect(() => story.append({ who: "claude", type: "say", cause: 5 })).toThrow();
  });

  it("tells subscribers about each new event until they unsubscribe", () => {
    const story = createStory(createManualClock());
    const seen: number[] = [];
    const stop = story.subscribe((e) => seen.push(e.seq));
    story.append({ who: "user", type: "stroke" });
    stop();
    story.append({ who: "user", type: "stroke" });
    expect(seen).toEqual([1]);
  });
});
