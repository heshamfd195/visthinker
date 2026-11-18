import { describe, expect, it } from "vitest";
import { ActArgs, ActResult } from "./index.ts";

const mark = { op: "mark", target: "c5", detail: { shape: "O" } };

describe("act (D91)", () => {
  it("takes 1 to 10 actions", () => {
    expect(ActArgs.safeParse({ actions: [mark] }).success).toBe(true);
    expect(ActArgs.safeParse({ actions: Array(10).fill(mark) }).success).toBe(true);
    expect(ActArgs.safeParse({ actions: [] }).success).toBe(false);
    expect(ActArgs.safeParse({ actions: Array(11).fill(mark) }).success).toBe(false);
  });

  it("names a target by id, never by pixels (D24)", () => {
    const pixels = { ...mark, target: [300, 300] };
    expect(ActArgs.safeParse({ actions: [pixels] }).success).toBe(false);
  });

  it("knows the five ops and no others", () => {
    const actions = [
      { op: "add", target: "board", detail: { kind: "note", label: "your turn" } },
      { op: "move", target: "m1", detail: { inside: "c3" } },
      mark,
      { op: "label", target: "c5", detail: { text: "centre" } },
      { op: "remove", target: "m1" },
    ];
    expect(ActArgs.safeParse({ actions }).success).toBe(true);
    expect(ActArgs.safeParse({ actions: [{ op: "paint", target: "c5" }] }).success).toBe(false);
  });

  it("puts an added object inside its anchor unless told 'near'", () => {
    const add = { op: "add", target: "board", detail: { kind: "note" } };
    const parsed = ActArgs.parse({ actions: [add] });
    expect(parsed.actions[0]).toMatchObject({ detail: { where: "inside" } });
  });

  it("reports each change as placed or proposed (Policy ✅ 9)", () => {
    const result = { applied: [{ seq: 12, type: "propose", target: "s3" }] };
    expect(ActResult.parse(result)).toEqual(result);
    const wrong = { applied: [{ seq: 12, type: "done", target: "s3" }] };
    expect(ActResult.safeParse(wrong).success).toBe(false);
  });
});
