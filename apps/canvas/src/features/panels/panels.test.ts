import type { VisEvent } from "@visthinker/contract";
import { beforeEach, describe as group, expect, it } from "vitest";
import { usePanels } from "./panels.store.ts";
import { clockText, describe, lagText, timing } from "./story.utils.ts";

const event = (e: Partial<VisEvent>): VisEvent => ({
  seq: 1,
  t: 0,
  who: "user",
  type: "stroke",
  ...e,
});

group("story lines", () => {
  it("a stroke shows its id and point count", () => {
    expect(describe(event({ target: "s1", detail: { box: [0, 0, 1, 1], points: 12 } }))).toBe(
      "stroke · s1 · 12 pts",
    );
  });

  it("a place shows kind and colour; a move shows from and to", () => {
    expect(
      describe(event({ type: "place", target: "b1", detail: { kind: "box", color: "#2f9e44" } })),
    ).toBe("place · b1 · box #2f9e44");
    expect(
      describe(
        event({
          type: "move",
          target: "b1",
          detail: { from: [10, 20, 5, 5], to: [10, 220, 5, 5] },
        }),
      ),
    ).toBe("move · b1 · (10, 20) → (10, 220)");
  });

  it("an event with nothing extra is just its type", () => {
    expect(describe(event({ type: "undo" }))).toBe("undo");
  });
});

group("times", () => {
  it("the clock reads in seconds, then minutes", () => {
    expect(clockText(12_400)).toBe("12.4 s");
    expect(clockText(123_400)).toBe("2:03.4");
  });

  it("the lag is in ms under a second", () => {
    expect(lagText(40)).toBe("+40 ms");
    expect(lagText(3_200)).toBe("+3.2 s");
  });

  it("a row shows its lag only if it has a cause", () => {
    const first = event({ seq: 1, t: 1_000 });
    const second = event({ seq: 2, t: 1_040, cause: 1 });
    const bySeq = new Map([first, second].map((e) => [e.seq, e]));
    expect(timing(first, bySeq)).toEqual({ at: "1.0 s", lag: null });
    expect(timing(second, bySeq)).toEqual({ at: "1.0 s", lag: "+40 ms" });
  });
});

group("panels", () => {
  beforeEach(() => usePanels.setState({ open: { story: true } }));

  it("the story panel starts open, and toggles", () => {
    expect(usePanels.getState().isOpen("story")).toBe(true);
    usePanels.getState().toggle("story");
    expect(usePanels.getState().isOpen("story")).toBe(false);
  });

  it("an unknown panel starts closed", () => {
    expect(usePanels.getState().isOpen("chat")).toBe(false);
    usePanels.getState().toggle("chat");
    expect(usePanels.getState().isOpen("chat")).toBe(true);
  });
});
