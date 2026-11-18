import { describe, expect, it } from "vitest";
import { BRIDGE_ONLY, BROWSER_CALLS, TOOLS, TOOL_NAMES, WAIT_DEFAULT_MS } from "./index.ts";

describe("TOOLS (D81)", () => {
  it("lists the generic tools, and no tic-tac-toe ones", () => {
    expect(TOOL_NAMES).toEqual([
      "open_canvas",
      "get_events",
      "get_scene",
      "get_strokes",
      "wait_for_event",
      "act",
      "say",
      "ask",
      "list_packs",
      "install_pack",
      "read_pack",
      "write_pack",
    ]);
    for (const old of ["get_board", "play", "wait_for_move"]) expect(TOOL_NAMES).not.toContain(old);
  });

  it("splits every tool between the bridge and the browser, once (D90)", () => {
    expect([...BRIDGE_ONLY, ...BROWSER_CALLS].sort()).toEqual([...TOOL_NAMES].sort());
    expect(BROWSER_CALLS).toContain("act");
    expect(BROWSER_CALLS).toContain("write_pack");
  });

  it("wait_for_event waits 60 s by default, between 1 s and 5 min (D25)", () => {
    expect(TOOLS.wait_for_event.args.parse({}).timeoutMs).toBe(WAIT_DEFAULT_MS);
    expect(TOOLS.wait_for_event.args.safeParse({ timeoutMs: 500 }).success).toBe(false);
    expect(TOOLS.wait_for_event.args.safeParse({ timeoutMs: 600_000 }).success).toBe(false);
  });

  it("say and ask keep text short, and ask offers at most 6 choices", () => {
    expect(TOOLS.say.args.safeParse({ text: "" }).success).toBe(false);
    expect(TOOLS.say.args.safeParse({ text: "x".repeat(2_001) }).success).toBe(false);
    const choices = ["a", "b", "c", "d", "e", "f", "g"];
    expect(TOOLS.ask.args.safeParse({ text: "Which?", choices }).success).toBe(false);
    expect(TOOLS.ask.args.safeParse({ text: "Which?", choices: choices.slice(0, 6) }).success).toBe(
      true,
    );
  });

  it("get_strokes needs a target, and open_canvas returns a URL", () => {
    expect(TOOLS.get_strokes.args.safeParse({}).success).toBe(false);
    expect(TOOLS.open_canvas.result.safeParse({ url: "not a url" }).success).toBe(false);
    expect(
      TOOLS.open_canvas.result.safeParse({ url: "http://localhost:5173/?t=abc" }).success,
    ).toBe(true);
  });
});
