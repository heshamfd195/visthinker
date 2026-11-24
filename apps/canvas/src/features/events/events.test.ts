import type { VisEvent } from "@visthinker/contract";
import type { CallRecord } from "@visthinker/core";
import { describe as group, expect, it } from "vitest";
import {
  describe,
  describeCall,
  isProblem,
  matches,
  mergeRows,
  mmss,
  rowDetail,
  rowTarget,
  status,
  statusText,
  type Row,
} from "./events.utils.ts";

const e = (x: Partial<VisEvent> & Pick<VisEvent, "seq" | "type">): VisEvent => ({
  t: 0,
  who: "user",
  ...x,
});
const call = (x: Partial<CallRecord> = {}): CallRecord => ({
  call: "get_scene",
  at: 0,
  ms: 300,
  ok: true,
  ...x,
});
const row = (event: VisEvent): Row => ({ kind: "event", key: `e${event.seq}`, at: event.t, event });
const callRow = (c: CallRecord): Row => ({ kind: "call", key: "c0", at: c.at, call: c });

group("plain words (D127)", () => {
  it("says what happened, shortly", () => {
    expect(describe(e({ seq: 1, type: "stroke", target: "s14" }))).toBe("stroke s14");
    expect(
      describe(
        e({
          seq: 2,
          who: "fastbrain",
          type: "recognized",
          target: "y3",
          detail: { kind: "symbol", label: "X", score: 0.92 },
        }),
      ),
    ).toBe("read X · y3 · 92%");
    expect(
      describe(
        e({
          seq: 3,
          who: "fastbrain",
          type: "recognized",
          target: "l1",
          detail: { kind: "line" },
        }),
      ),
    ).toBe("read line · l1");
    expect(describe(e({ seq: 4, type: "place", target: "b2", detail: { kind: "box" } }))).toBe(
      "placed box · b2",
    );
    expect(
      describe(
        e({
          seq: 5,
          who: "fastbrain",
          type: "place",
          target: "n1",
          // What act sends: the Fast Brain applies it and names Claude.
          detail: { kind: "note", near: "b2", by: "claude" },
        }),
      ),
    ).toBe("placed note · n1 · near b2 · by Claude");
    expect(
      describe(e({ seq: 6, type: "message", detail: { text: "what is this?", refs: ["b1"] } })),
    ).toBe("you said: what is this? · with b1");
    expect(describe(e({ seq: 7, who: "claude", type: "ask", detail: { text: "Again?" } }))).toBe(
      "Claude asked: Again?",
    );
    expect(
      describe(
        e({
          seq: 8,
          who: "claude",
          type: "answer",
          cause: 7,
          detail: { choice: "no", text: "Not this time" },
        }),
      ),
    ).toBe("Claude declined: Not this time");
    expect(
      describe(
        e({
          seq: 9,
          who: "claude",
          type: "propose",
          target: "b1",
          detail: { op: "move", near: "b2" },
        }),
      ),
    ).toBe("Claude proposed: move b1 · near b2");
    expect(describe(e({ seq: 10, type: "mode", detail: { mode: "playing", manual: true } }))).toBe(
      "mode → playing · by hand",
    );
    expect(describe(e({ seq: 11, type: "clear" }))).toBe("cleared the canvas");
  });

  it("an unreadable symbol says so", () => {
    expect(
      describe(
        e({
          seq: 1,
          who: "fastbrain",
          type: "recognized",
          target: "y1",
          detail: { kind: "symbol", label: "?", score: 0 },
        }),
      ),
    ).toBe("couldn't read · y1");
  });

  it("a call reads as Claude, the tool and its time, with ✗ when it failed", () => {
    expect(describeCall(call())).toBe("Claude · get_scene 0.3 s");
    expect(describeCall(call({ ok: false, ms: 1250 }))).toBe("Claude · get_scene 1.3 s ✗");
  });
});

group("filters", () => {
  const read = row(
    e({
      seq: 1,
      who: "fastbrain",
      type: "recognized",
      detail: { kind: "symbol", label: "X", score: 0.9 },
    }),
  );
  const unsure = row(
    e({
      seq: 2,
      who: "fastbrain",
      type: "recognized",
      detail: { kind: "symbol", label: "O", score: 0.3 },
    }),
  );
  const mine = row(e({ seq: 3, type: "stroke", target: "s1" }));
  const said = row(e({ seq: 4, who: "claude", type: "say", detail: { text: "hi" } }));
  const failed = callRow(call({ ok: false }));

  it("You, Claude and Read pick by who and what", () => {
    expect([read, mine, said, failed].filter((r) => matches(r, "you"))).toEqual([mine]);
    expect([read, mine, said, failed].filter((r) => matches(r, "claude"))).toEqual([said, failed]);
    expect([read, mine, said, failed].filter((r) => matches(r, "read"))).toEqual([read]);
    expect([read, mine, said, failed].every((r) => matches(r, "all"))).toBe(true);
  });

  it("Problems are unsure readings and failed calls", () => {
    expect([read, unsure, mine, failed].filter(isProblem)).toEqual([unsure, failed]);
    expect(
      isProblem(
        row(
          e({
            seq: 5,
            who: "fastbrain",
            type: "recognized",
            detail: { kind: "symbol", label: "?" },
          }),
        ),
      ),
    ).toBe(true);
  });
});

group("time", () => {
  it("mm:ss from the session clock", () => {
    expect(mmss(0)).toBe("00:00");
    expect(mmss(65_400)).toBe("01:05");
    expect(mmss(3_725_000)).toBe("62:05");
  });

  it("events and calls merge in time order, events first on a tie", () => {
    const rows = mergeRows(
      [e({ seq: 1, t: 100, type: "stroke" }), e({ seq: 2, t: 500, type: "stroke" })],
      [call({ at: 500 }), call({ at: 50, call: "get_events" })],
    );
    expect(rows.map((r) => r.key)).toEqual(["c1", "e1", "e2", "c0"]);
    expect(rowTarget(rows[1]!)).toBeUndefined();
  });

  it("the status says listening, thinking with seconds, not watching, or not connected", () => {
    expect(statusText(status(true, undefined))).toBe("Claude is listening");
    expect(statusText(status(true, 1000), 4100)).toBe("Claude is thinking… 4.1 s");
    expect(statusText(status(false, undefined))).toBe("Claude is connected, not watching");
    expect(statusText(status(false, undefined, false))).toBe("Not connected to Claude");
    expect(statusText(status(true, 1000, false))).toBe("Not connected to Claude");
  });
});

group("letters from the handwriting ability (T51)", () => {
  const letter = e({
    seq: 9,
    type: "letter",
    who: "fastbrain",
    target: "y3",
    cause: 8,
    detail: {
      index: 1,
      of: 5,
      strokes: ["s1", "s2", "s3"],
      features: {
        strokes: 3,
        box: [0, 0, 60, 80],
        aspect: 1.33,
        parts: [
          { kind: "line", stroke: 0, a: [0, 0], b: [0, 1], length: 1, angle: 90 },
          { kind: "line", stroke: 1, a: [1, 0], b: [1, 1], length: 1, angle: 90 },
          { kind: "line", stroke: 2, a: [0, 0.5], b: [1, 0.5], length: 0.75, angle: 0 },
        ],
        meets: [],
        crossings: [
          { parts: [0, 2], t: 0.5, u: 0, at: [0, 0.5], angle: 90 },
          { parts: [1, 2], t: 0.5, u: 1, at: [1, 0.5], angle: 90 },
        ],
        loops: [],
      },
    },
  });

  it("says which letter of the word it is and what was measured, in one line", () => {
    expect(describe(letter)).toBe(
      "letter 1 of 5 · y3 · 3 lines | | — · no meets · 2 crossings · no loops",
    );
  });

  it("opens to the full breakdown, then the raw event", () => {
    const text = rowDetail(row(letter));
    expect(text).toContain("parts      1  line  | 90°");
    expect(text).toContain("crossings  1 and 3 touch at (0.00, 0.50) middle left");
    expect(text).toContain('"type": "letter"');
  });

  it("a written word says how many letters it has, and isn't a problem", () => {
    const word = e({
      seq: 3,
      type: "recognized",
      who: "fastbrain",
      target: "w1",
      detail: { kind: "word", letters: [["s1"], ["s2"], ["s3"]] },
    });
    expect(describe(word)).toBe("read a word · w1 · 3 letters");
    expect(isProblem(row(word))).toBe(false);
  });

  it("a named letter says its name and score; an unsure one its two best guesses, under Problems", () => {
    const named = {
      ...letter,
      detail: {
        ...letter.detail,
        reading: {
          label: "H",
          score: 100,
          clear: true,
          guesses: [
            { char: "H", score: 100 },
            { char: "A", score: 50 },
          ],
        },
      },
    };
    expect(describe(named)).toBe(
      "letter 1 of 5 · H 100% · y3 · 3 lines | | — · no meets · 2 crossings · no loops",
    );
    expect(isProblem(row(named))).toBe(false);
    const unsure = {
      ...letter,
      detail: {
        ...letter.detail,
        reading: {
          label: "?",
          score: 60,
          clear: false,
          guesses: [
            { char: "L", score: 60 },
            { char: "E", score: 41 },
          ],
        },
      },
    };
    expect(describe(unsure)).toContain("letter 1 of 5 · ? (L 60 · E 41) · y3");
    expect(isProblem(row(unsure))).toBe(true);
  });

  it("a word read by its letters says the word; one with an unsure letter is a problem", () => {
    const word = (text: string) =>
      e({
        seq: 3,
        type: "recognized",
        who: "fastbrain",
        target: "w1",
        detail: { kind: "word", letters: [["s1"], ["s2"]], text },
      });
    expect(describe(word("HELLO"))).toBe("read HELLO · w1");
    expect(isProblem(row(word("HELLO")))).toBe(false);
    expect(isProblem(row(word("HE?LO")))).toBe(true);
  });

  it("two words joined by a later stroke read as a merge", () => {
    expect(
      describe(
        e({ seq: 4, type: "remove", who: "fastbrain", target: "y2", detail: { into: "y1" } }),
      ),
    ).toBe("merged y2 into y1");
  });

  it("shows under Read, and a broken one still gets a line", () => {
    expect(matches(row(letter), "read")).toBe(true);
    expect(describe({ ...letter, detail: { index: "x" } })).toBe("letter · y3");
  });
});
