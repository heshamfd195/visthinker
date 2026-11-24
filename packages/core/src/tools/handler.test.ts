import { TOOLS } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import {
  createSceneStore,
  createStory,
  createStrokeStore,
  placeObject,
  recordStroke,
} from "../scene/index.ts";
import { createPackRegistry } from "../packs/index.ts";
import { createToolHandler } from "./index.ts";

const stroke = (id: string) => ({
  id,
  t0: 0,
  tool: "pen",
  color: "#222",
  width: 4,
  points: [
    [0, 0, 0.5, 0],
    [100, 0, 0.5, 16],
  ],
});

function setup() {
  const clock = createManualClock();
  const story = createStory(clock);
  const scene = createSceneStore();
  const strokes = createStrokeStore();
  const handle = createToolHandler({ clock, packs: createPackRegistry(), story, scene, strokes });
  return { clock, story, scene, strokes, handle };
}

describe("get_events (D77)", () => {
  it("gives only the events since the last read", async () => {
    const { story, strokes, handle } = setup();
    recordStroke(story, strokes, stroke("s1"));
    const first = TOOLS.get_events.result.parse(await handle("get_events", {}));
    expect(first.events.map((e) => e.seq)).toEqual([1]);
    expect(TOOLS.get_events.result.parse(await handle("get_events", {})).events).toEqual([]);
    recordStroke(story, strokes, stroke("s2"));
    const next = TOOLS.get_events.result.parse(await handle("get_events", {}));
    expect(next.events.map((e) => e.target)).toEqual(["s2"]);
  });
});

describe("release: the canvas moves to another project", () => {
  it("ends every open wait at once, as a timeout, and Claude stops listening", async () => {
    const { handle } = setup();
    const waiting = handle("wait_for_event", { timeoutMs: 60_000 }) as Promise<{
      events: unknown[];
      timedOut: boolean;
    }>;
    expect(handle.listening()).toBe(true);
    handle.release();
    await expect(waiting).resolves.toEqual({ events: [], timedOut: true });
    expect(handle.listening()).toBe(false);
  });

  it("does nothing when no one is waiting", () => {
    const { handle } = setup();
    expect(() => handle.release()).not.toThrow();
  });
});

describe("wait_for_event (D25)", () => {
  const wait = (h: ReturnType<typeof setup>["handle"], args: Record<string, unknown> = {}) =>
    h("wait_for_event", args) as Promise<{
      events: { seq: number; type: string }[];
      timedOut: boolean;
    }>;
  // Let queued microtasks (the story waking its waiters) run; the core has no setTimeout.
  const tick = async () => {
    for (let i = 0; i < 5; i++) await new Promise<void>((r) => queueMicrotask(r));
  };

  it("answers at once when a matching event is already unread", async () => {
    const { story, strokes, handle } = setup();
    recordStroke(story, strokes, stroke("s1"));
    const result = await wait(handle);
    expect(result.timedOut).toBe(false);
    expect(result.events.map((e) => e.seq)).toEqual([1]);
  });

  it("waits, then answers as soon as the user acts", async () => {
    const { story, strokes, handle } = setup();
    let answered = false;
    const pending = wait(handle).then((r) => ((answered = true), r));
    await tick();
    expect(answered).toBe(false);
    recordStroke(story, strokes, stroke("s1"));
    const result = await pending;
    expect(result).toMatchObject({ timedOut: false, events: [{ seq: 1, type: "stroke" }] });
  });

  it("ignores events that don't match the filter, and returns them with the match", async () => {
    const { story, scene, strokes, handle } = setup();
    let answered = false;
    const pending = wait(handle, { types: ["place"], who: ["user"] }).then(
      (r) => ((answered = true), r),
    );
    recordStroke(story, strokes, stroke("s1"));
    story.append({ who: "claude", type: "place", target: "x" });
    await tick();
    expect(answered).toBe(false);
    placeObject(story, scene, { kind: "box", box: [0, 0, 1, 1], color: "#222" });
    const result = await pending;
    expect(result.events.map((e) => e.type)).toEqual(["stroke", "place", "place"]);
  });

  it("times out on the session clock with whatever is unread", async () => {
    const { clock, handle } = setup();
    const pending = wait(handle, { timeoutMs: 5_000 });
    clock.advance(4_999);
    await tick();
    clock.advance(1);
    expect(await pending).toEqual({ events: [], timedOut: true });
  });

  it("moves the read cursor, so get_events after it is empty", async () => {
    const { story, strokes, handle } = setup();
    recordStroke(story, strokes, stroke("s1"));
    await wait(handle);
    expect(await handle("get_events", {})).toEqual({ events: [] });
  });

  it("one change wakes the waiter once, with every event it made", async () => {
    const { story, handle } = setup();
    const pending = wait(handle, { types: ["stroke"] });
    story.append({ who: "user", type: "stroke", target: "s1" });
    story.append({ who: "fastbrain", type: "recognized", target: "l1", cause: 1 });
    const result = await pending;
    expect(result.events.map((e) => e.type)).toEqual(["stroke", "recognized"]);
  });

  it("refuses a timeout under 1 s or over 5 min (D90)", async () => {
    await expect(setup().handle("wait_for_event", { timeoutMs: 10 })).rejects.toMatchObject({
      code: "bad_args",
    });
  });
});

describe("get_scene (D77)", () => {
  it("gives the whole current scene, fitting the contract", async () => {
    const { story, scene, handle } = setup();
    placeObject(story, scene, { kind: "box", box: [0, 0, 10, 10], color: "#222" });
    const result = TOOLS.get_scene.result.parse(await handle("get_scene", {}));
    expect(result.objects.map((o) => o.id)).toEqual(["b1"]);
  });
});

describe("get_strokes (D76)", () => {
  it("gives a stroke's own raw points by its id", async () => {
    const { story, strokes, handle } = setup();
    recordStroke(story, strokes, stroke("s1"));
    const result = TOOLS.get_strokes.result.parse(await handle("get_strokes", { target: "s1" }));
    expect(result.strokes).toEqual([stroke("s1")]);
  });

  it("gives the strokes that made an object", async () => {
    const { story, scene, strokes, handle } = setup();
    recordStroke(story, strokes, stroke("s1"));
    recordStroke(story, strokes, stroke("s2"));
    scene.add(
      {
        id: "l1",
        kind: "line",
        label: "line",
        pack: "shapes",
        parts: [],
        relations: [],
        box: [0, 0, 100, 0],
        confidence: 0.9,
        strokes: ["s1", "s2"],
      },
      "fastbrain",
    );
    const result = TOOLS.get_strokes.result.parse(await handle("get_strokes", { target: "l1" }));
    expect(result.strokes.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("a pre-built object was never drawn, so it has no strokes", async () => {
    const { story, scene, handle } = setup();
    placeObject(story, scene, { kind: "box", box: [0, 0, 10, 10], color: "#222" });
    expect(await handle("get_strokes", { target: "b1" })).toEqual({ strokes: [] });
  });

  it("an unknown target says so", async () => {
    await expect(setup().handle("get_strokes", { target: "nope" })).rejects.toMatchObject({
      code: "unknown_target",
    });
  });
});

describe("every call", () => {
  it("checks args against the contract", async () => {
    await expect(setup().handle("get_strokes", {})).rejects.toMatchObject({ code: "bad_args" });
  });

  it("write_pack loads a pack Claude wrote and says so in the story", async () => {
    const { story, handle } = setup();
    const pack = {
      "pack.json": {
        name: "noughts",
        version: "0.2.0",
        contract: "0",
        match: {},
        blocks: ["grid"],
      },
    };
    expect(await handle("write_pack", { pack })).toEqual({
      name: "noughts",
      version: "0.2.0",
      loaded: true,
    });
    expect(story.all().at(-1)).toMatchObject({
      who: "fastbrain",
      type: "pack",
      detail: { name: "noughts", by: "claude" },
    });
  });
});
