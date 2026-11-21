import { describe, expect, it } from "vitest";
import { ActArgs, ActResult } from "./index.ts";

const label = { op: "label", target: "s1", detail: { text: "start" } };

describe("act (D91)", () => {
  it("takes 1 to 10 actions", () => {
    expect(ActArgs.safeParse({ actions: [label] }).success).toBe(true);
    expect(ActArgs.safeParse({ actions: Array(10).fill(label) }).success).toBe(true);
    expect(ActArgs.safeParse({ actions: [] }).success).toBe(false);
    expect(ActArgs.safeParse({ actions: Array(11).fill(label) }).success).toBe(false);
  });

  it("names a target by id, never by pixels (D24)", () => {
    const pixels = { ...label, target: [300, 300] };
    expect(ActArgs.safeParse({ actions: [pixels] }).success).toBe(false);
  });

  it("knows the four ops and no others", () => {
    const actions = [
      { op: "add", target: "b1", detail: { kind: "note", label: "your turn" } },
      { op: "move", target: "n1", detail: { inside: "b2" } },
      label,
      { op: "remove", target: "n1" },
    ];
    expect(ActArgs.safeParse({ actions }).success).toBe(true);
    expect(ActArgs.safeParse({ actions: [{ op: "paint", target: "s1" }] }).success).toBe(false);
    const mark = { op: "mark", target: "c5", detail: { shape: "O" } };
    expect(ActArgs.safeParse({ actions: [mark] }).success).toBe(false);
  });

  it("puts an added object inside its anchor unless told 'near'", () => {
    const add = { op: "add", target: "b1", detail: { kind: "note" } };
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
