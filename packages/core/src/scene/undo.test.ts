import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import { createStory, findUndoable, undo, undoneSeqs } from "./index.ts";

describe("undo is an event (D78)", () => {
  it("appends an undo that points at the latest user stroke or mark", () => {
    const story = createStory(createManualClock());
    story.append({ who: "user", type: "stroke", target: "s1" });
    story.append({ who: "user", type: "stroke", target: "s2" });
    story.append({ who: "claude", type: "say" });
    const first = undo(story);
    expect(first).toMatchObject({ type: "undo", cause: 2, target: "s2" });
    expect(undo(story)).toMatchObject({ cause: 1, target: "s1" });
    expect(story.all()).toHaveLength(5);
  });

  it("never undoes Claude's or the Fast Brain's events", () => {
    const story = createStory(createManualClock());
    story.append({ who: "claude", type: "mark", target: "m1" });
    story.append({ who: "fastbrain", type: "recognized", target: "l1" });
    expect(findUndoable(story.all())).toBeUndefined();
    expect(undo(story)).toBeUndefined();
    expect(story.all()).toHaveLength(2);
  });

  it("knows which events were taken back", () => {
    const story = createStory(createManualClock());
    story.append({ who: "user", type: "stroke" });
    story.append({ who: "user", type: "mark" });
    undo(story);
    expect([...undoneSeqs(story.all())]).toEqual([2]);
  });
});
