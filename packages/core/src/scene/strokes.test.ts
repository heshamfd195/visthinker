import { StrokeEventDetail } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import { createStory, createStrokeStore, recordStroke, strokeBox } from "./index.ts";

const stroke = (id: string) => ({
  id,
  t0: 0,
  tool: "pen",
  color: "#222",
  width: 4,
  points: [
    [10, 20, 0.5, 0],
    [40.04, 25, 0.6, 16],
    [30, 60.06, 0.4, 33],
  ],
});

describe("strokes (D88)", () => {
  it("a stroke becomes one event with its box and point count, never the points", () => {
    const story = createStory(createManualClock());
    const strokes = createStrokeStore();
    const event = recordStroke(story, strokes, stroke("s1"));
    expect(event).toMatchObject({ seq: 1, who: "user", type: "stroke", target: "s1" });
    expect(StrokeEventDetail.parse(event.detail)).toEqual({ box: [10, 20, 30, 40.1], points: 3 });
  });

  it("keeps the raw stroke to hand back later, as a copy", () => {
    const strokes = createStrokeStore();
    recordStroke(createStory(createManualClock()), strokes, stroke("s1"));
    strokes.get("s1")!.points[0]![0] = 999;
    expect(strokes.get("s1")).toEqual(stroke("s1"));
    expect(strokes.all()).toHaveLength(1);
  });

  it("records the same stroke once, even if it's sent twice", () => {
    const story = createStory(createManualClock());
    const strokes = createStrokeStore();
    const first = recordStroke(story, strokes, stroke("s1"));
    expect(recordStroke(story, strokes, stroke("s1"))).toEqual(first);
    expect(story.all()).toHaveLength(1);
  });

  it("refuses a stroke that doesn't fit the contract", () => {
    const story = createStory(createManualClock());
    expect(() => recordStroke(story, createStrokeStore(), { id: "s1", points: [] })).toThrow();
    expect(story.all()).toHaveLength(0);
  });

  it("hands out stroke ids that are never reused", () => {
    const strokes = createStrokeStore();
    expect([strokes.nextId(), strokes.nextId()]).toEqual(["s1", "s2"]);
  });

  it("the box rounds to one decimal", () => {
    expect(strokeBox({ ...stroke("s1"), points: [[0.04, 0, 0.5, 0]] } as never)).toEqual([
      0, 0, 0, 0,
    ]);
  });
});
