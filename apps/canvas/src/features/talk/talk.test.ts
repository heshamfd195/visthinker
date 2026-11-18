import type { VisEvent } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { messageFromStory, winningLine } from "./talk.utils.ts";

const e = (x: Partial<VisEvent> & Pick<VisEvent, "seq" | "type">): VisEvent => ({
  t: 0,
  who: "claude",
  ...x,
});

describe("the message strip", () => {
  it("shows nothing until Claude speaks", () => {
    expect(messageFromStory([e({ seq: 1, who: "user", type: "stroke" })])).toBeNull();
  });

  it("shows the latest say", () => {
    const events = [
      e({ seq: 1, type: "say", detail: { text: "hi" } }),
      e({ seq: 2, type: "say", detail: { text: "your move" } }),
    ];
    expect(messageFromStory(events)).toEqual({
      seq: 2,
      kind: "say",
      text: "your move",
      choices: [],
    });
  });

  it("an ask offers its choices until it's answered", () => {
    const ask = e({
      seq: 1,
      type: "ask",
      detail: { text: "Tic-tac-toe?", choices: ["yes", "no"] },
    });
    expect(messageFromStory([ask])?.choices).toEqual(["yes", "no"]);
    const answer = e({ seq: 2, who: "user", type: "answer", cause: 1, detail: { choice: "yes" } });
    expect(messageFromStory([ask, answer])?.choices).toEqual([]);
    expect(messageFromStory([ask], new Set([1]))?.choices).toEqual([]);
  });

  it("a proposal reads plainly and offers accept or decline", () => {
    const propose = e({
      seq: 3,
      type: "propose",
      target: "b1",
      detail: { op: "move", near: "c5" },
    });
    expect(messageFromStory([propose])).toEqual({
      seq: 3,
      kind: "propose",
      text: "Claude suggests: move b1 near c5",
      choices: ["accept", "decline"],
    });
  });

  it("the end of a game says who won, and highlights the line", () => {
    const end = e({
      seq: 9,
      who: "fastbrain",
      type: "end",
      detail: { winner: "claude", mark: "O", line: ["c3", "c5", "c7"] },
    });
    expect(messageFromStory([end])).toEqual({
      seq: 9,
      kind: "end",
      text: "Claude wins.",
      choices: [],
    });
    expect([...winningLine([end])]).toEqual(["c3", "c5", "c7"]);
    const draw = e({ seq: 9, who: "fastbrain", type: "end", detail: { winner: null, line: [] } });
    expect(messageFromStory([draw])?.text).toBe("It's a draw.");
  });
});
