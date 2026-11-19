import type { ModeInfo, ModeState } from "@visthinker/core";
import { describe, expect, it } from "vitest";
import { chipText, modeLabel, noteText } from "./modes.utils.ts";

const state = (s: Partial<ModeState>): ModeState => ({
  mode: undefined,
  manual: false,
  seq: undefined,
  by: undefined,
  reason: undefined,
  ...s,
});

const infos: Partial<Record<"playing" | "learning", ModeInfo>> = {
  learning: { label: "Learning together", role: "Claude explains", card: "…" },
};

describe("modeLabel (D139)", () => {
  it("uses the pack's label, else the id with a capital", () => {
    expect(modeLabel("learning", infos)).toBe("Learning together");
    expect(modeLabel("playing", infos)).toBe("Playing");
    expect(modeLabel("contributing")).toBe("Contributing");
  });
});

describe("chipText (D129)", () => {
  it("auto shows the mode Claude is in, or plain Auto before any", () => {
    expect(chipText(state({}))).toEqual({ main: "Auto" });
    expect(chipText(state({ mode: "playing", by: "claude", seq: 3 }))).toEqual({
      main: "Auto · Playing",
    });
  });

  it("a mode picked by hand shows its name and 'manual'", () => {
    expect(chipText(state({ mode: "learning", manual: true, by: "user", seq: 4 }), infos)).toEqual({
      main: "Learning together",
      sub: "manual",
    });
  });
});

describe("noteText (D129)", () => {
  it("nothing before the first mode event", () => {
    expect(noteText(state({}))).toBeUndefined();
  });

  it("Claude's switch carries its reason", () => {
    expect(
      noteText(state({ mode: "playing", by: "claude", seq: 5, reason: "you drew a board" })),
    ).toBe("Claude switched to playing: you drew a board");
    expect(noteText(state({ mode: "teaching", by: "claude", seq: 5 }))).toBe(
      "Claude switched to teaching",
    );
  });

  it("a mode picked by hand holds until auto", () => {
    expect(noteText(state({ mode: "teaching", manual: true, by: "user", seq: 6 }))).toBe(
      "Teaching until you switch back to auto",
    );
  });

  it("back to auto says Claude picks again", () => {
    expect(noteText(state({ by: "user", seq: 7 }))).toBe(
      "Auto: Claude picks from what you say and draw",
    );
  });
});
