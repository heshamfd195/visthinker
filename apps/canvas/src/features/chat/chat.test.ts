import type { SceneObject, VisEvent } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { chatStatus, dotsFor, isAnswered, lastClaudeWords, threadFor } from "./chat.utils.ts";

const e = (x: Partial<VisEvent> & Pick<VisEvent, "seq" | "type">): VisEvent => ({
  t: 0,
  who: "claude",
  ...x,
});
const obj = (id: string, box: [number, number, number, number]): SceneObject => ({
  id,
  kind: "box",
  label: "box",
  pack: "shapes",
  parts: [],
  relations: [],
  box,
  confidence: 1,
});

describe("the thread", () => {
  it("keeps this chat's messages and those that name no chat", () => {
    const events = [
      e({ seq: 1, who: "user", type: "message", detail: { text: "hi", chat: "a" } }),
      e({ seq: 2, who: "user", type: "message", detail: { text: "other", chat: "b" } }),
      e({ seq: 3, type: "say", detail: { text: "hello" } }),
      e({ seq: 4, who: "user", type: "stroke", target: "s1" }),
    ];
    expect(threadFor(events, "a").map((i) => i.seq)).toEqual([1, 3]);
  });

  it("an ask shows its choices until answered, then the choice", () => {
    const ask = e({
      seq: 1,
      type: "ask",
      target: "c5",
      detail: { text: "Here?", choices: ["yes", "no"] },
    });
    expect(threadFor([ask], "a")).toEqual([
      {
        kind: "claude",
        seq: 1,
        from: "claude",
        text: "Here?",
        target: "c5",
        choices: ["yes", "no"],
      },
    ]);
    const answer = e({ seq: 2, who: "user", type: "answer", cause: 1, detail: { choice: "no" } });
    expect(threadFor([ask, answer], "a")).toEqual([
      {
        kind: "claude",
        seq: 1,
        from: "claude",
        text: "Here?",
        target: "c5",
        choices: [],
        answer: "no",
      },
    ]);
    expect(threadFor([ask], "a", new Map([[1, "yes"]]))[0]).toMatchObject({
      choices: [],
      answer: "yes",
    });
    expect(isAnswered([ask, answer], 1)).toBe(true);
    expect(isAnswered([ask], 1)).toBe(false);
  });

  it("the Fast Brain's question shows too (D68)", () => {
    const ask = e({
      seq: 5,
      who: "fastbrain",
      type: "ask",
      detail: { text: "Is this an A? Shall I label it?", choices: ["yes", "no"] },
    });
    expect(threadFor([ask], "a")[0]).toMatchObject({
      kind: "claude",
      from: "fastbrain",
      choices: ["yes", "no"],
    });
  });

  it("a proposal reads plainly and knows when it's answered", () => {
    const propose = e({
      seq: 3,
      type: "propose",
      target: "b1",
      detail: { op: "move", near: "c5" },
    });
    expect(threadFor([propose], "a")).toEqual([
      { kind: "propose", seq: 3, text: "Proposed: move b1 near c5", target: "b1", answered: false },
    ]);
    const answer = e({
      seq: 4,
      who: "user",
      type: "answer",
      cause: 3,
      detail: { choice: "accept" },
    });
    expect(threadFor([propose, answer], "a")[0]).toMatchObject({
      answered: true,
      answer: "accept",
    });
  });
});

describe("Claude's last words", () => {
  it("are the latest say or ask, cut short", () => {
    const events = [
      e({ seq: 1, type: "say", detail: { text: "first" } }),
      e({ seq: 2, type: "ask", detail: { text: "a long question indeed" } }),
      e({ seq: 3, who: "user", type: "message", detail: { text: "mine" } }),
    ];
    expect(lastClaudeWords(events, "a")).toBe("a long question indeed");
    expect(lastClaudeWords(events, "a", 7)).toBe("a long…");
    expect(lastClaudeWords([], "a")).toBeUndefined();
  });
});

describe("the status line (D134)", () => {
  it("says listening, not watching or not connected", () => {
    expect(chatStatus(true, true)).toBe("Claude is listening");
    expect(chatStatus(false, true)).toBe(
      "Claude is connected, not watching. Your message will wait",
    );
    expect(chatStatus(false, false)).toBe("Not connected to Claude");
  });
});

describe("reply dots (D136)", () => {
  it("one per target, at its top-right corner, the latest message winning", () => {
    const events = [
      e({ seq: 1, type: "say", target: "b1", detail: { text: "this one" } }),
      e({ seq: 2, type: "say", target: "b9", detail: { text: "gone" } }),
      e({ seq: 3, type: "say", target: "b1", detail: { text: "again" } }),
      e({ seq: 4, who: "fastbrain", type: "say", target: "c1", detail: { text: "not Claude" } }),
      e({ seq: 5, type: "ask", target: "c1", detail: { text: "an ask" } }),
    ];
    expect(dotsFor(events, [obj("b1", [10, 20, 30, 40]), obj("c1", [0, 0, 5, 5])])).toEqual([
      { seq: 3, target: "b1", x: 40, y: 20 },
    ]);
  });
});
