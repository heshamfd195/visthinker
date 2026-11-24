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
    expect(
      describe(e({ seq: 12, type: "project", detail: { name: "Untitled", opened: "new" } })),
    ).toBe("started a new project “Untitled”");
    expect(
      describe(e({ seq: 13, type: "project", detail: { name: "Hello", opened: "saved" } })),
    ).toBe("opened “Hello”");
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
