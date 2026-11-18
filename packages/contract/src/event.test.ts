import { describe, expect, it } from "vitest";
import { KNOWN_EVENT_TYPES, RecognizedEventDetail, StrokeEventDetail, VisEvent } from "./index.ts";

describe("VisEvent (D79)", () => {
  it("needs seq, t, who and type; the rest is optional", () => {
    const min = { seq: 1, t: 0, who: "user", type: "stroke" };
    expect(VisEvent.parse(min)).toEqual(min);
    const full = { ...min, seq: 2, target: "s1", detail: { box: [0, 0, 10, 10] }, cause: 1 };
    expect(VisEvent.parse(full)).toEqual(full);
  });

  it("starts seq at 1 and keeps it a whole number", () => {
    expect(VisEvent.safeParse({ seq: 0, t: 0, who: "user", type: "stroke" }).success).toBe(false);
    expect(VisEvent.safeParse({ seq: 1.5, t: 0, who: "user", type: "stroke" }).success).toBe(false);
  });

  it("knows four kinds of actor and no others", () => {
    for (const who of ["user", "fastbrain", "claude", "api"]) {
      expect(VisEvent.safeParse({ seq: 1, t: 0, who, type: "say" }).success).toBe(true);
    }
    expect(VisEvent.safeParse({ seq: 1, t: 0, who: "robot", type: "say" }).success).toBe(false);
  });

  it("accepts a pack's own event type, but not an empty one", () => {
    expect(VisEvent.safeParse({ seq: 1, t: 0, who: "fastbrain", type: "win" }).success).toBe(true);
    expect(VisEvent.safeParse({ seq: 1, t: 0, who: "fastbrain", type: "" }).success).toBe(false);
    expect(KNOWN_EVENT_TYPES).toContain("undo");
  });

  it("a cause points back to an earlier seq", () => {
    expect(
      VisEvent.safeParse({ seq: 3, t: 5, who: "claude", type: "mark", cause: 0 }).success,
    ).toBe(false);
  });
});

describe("event details", () => {
  it("a stroke event carries its box and point count, never the points (D88)", () => {
    expect(StrokeEventDetail.safeParse({ box: [0, 0, 10, 10], points: 12 }).success).toBe(true);
    expect(StrokeEventDetail.safeParse({ box: [0, 0, -1, 10], points: 12 }).success).toBe(false);
  });

  it("a recognized event names the kind (D89)", () => {
    expect(RecognizedEventDetail.safeParse({ kind: "line" }).success).toBe(true);
    expect(RecognizedEventDetail.safeParse({ kind: "" }).success).toBe(false);
  });
});
