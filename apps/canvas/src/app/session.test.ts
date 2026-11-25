import type { HandwritingExample, HandwritingExamples } from "@visthinker/contract";
import { createExampleBook, createManualClock, placeObject } from "@visthinker/core";
import { describe, expect, it } from "vitest";
import type { BridgeHttp } from "../adapters/bridge-http/index.ts";
import { createSystemClock } from "../adapters/system-clock/index.ts";
import { createSession, keepExamples, SAVE_EXAMPLES_MS } from "./session.ts";

describe("composition root (D83)", () => {
  it("wires the core to a port for each need; on its own, only the transport is a fake", () => {
    const session = createSession({ clock: createManualClock() });
    expect(session.fakes).toEqual(["transport"]);
    expect(session.http).toBeUndefined();
    expect(session.transport.status()).toBe("ready");
    expect(session.packs.names()).toEqual([]);
  });

  it("stamps the story from the session clock", () => {
    const clock = createManualClock();
    const { story } = createSession({ clock });
    clock.advance(40);
    expect(story.append({ who: "user", type: "stroke" }).t).toBe(40);
  });

  it("each session starts its own story and scene", () => {
    const a = createSession({ clock: createManualClock() });
    const b = createSession({ clock: createManualClock() });
    a.story.append({ who: "user", type: "stroke" });
    a.scene.nextId("l");
    expect(b.story.all()).toHaveLength(0);
    expect(b.scene.nextId("l")).toBe("l1");
  });
});

describe("transport (T18)", () => {
  it("opened on its own, the transport is a fake and there's no bridge", () => {
    const session = createSession({ clock: createManualClock() });
    expect(session.bridge).toBeUndefined();
    expect(session.fakes).toContain("transport");
  });

  it("opened from the bridge's link, the transport is the WebSocket, not yet started", () => {
    const session = createSession({
      clock: createManualClock(),
      bridgeUrl: "ws://127.0.0.1:1/?token=t",
    });
    expect(session.bridge).toBe(session.transport);
    expect(session.fakes).toEqual([]);
    expect(session.transport.status()).toBe("connecting");
  });

  it("Claude's calls are answered by the core: get_scene sees what was placed (T19)", async () => {
    const session = createSession({ clock: createManualClock() });
    placeObject(session.story, session.scene, { kind: "box", box: [0, 0, 10, 10], color: "#222" });
    const memory = session.transport as unknown as {
      call(c: string, a: unknown): Promise<unknown>;
    };
    const result = (await memory.call("get_scene", {})) as { objects: { id: string }[] };
    expect(result.objects.map((o) => o.id)).toEqual(["b1"]);
  });
});

describe("packs (T24)", () => {
  it("the starter packs are built in (D74)", () => {
    const session = createSession({ clock: createManualClock() });
    expect(session.registry.names()).toEqual(["shapes", "modes"]);
  });
});

describe("renderer (T13)", () => {
  it("each new event pushes the current scene to the screen", () => {
    const session = createSession({ clock: createManualClock() });
    expect(session.renderer.frame()).toEqual([]);
    placeObject(session.story, session.scene, { kind: "box", box: [0, 0, 10, 10], color: "#222" });
    expect(session.renderer.frame().map((o) => o.id)).toEqual(["b1"]);
  });
});

describe("system clock", () => {
  it("counts whole milliseconds from when the session started", () => {
    let wall = 1_000.4;
    const clock = createSystemClock(() => wall);
    wall = 1_250.9;
    expect(clock.now()).toBe(251);
  });
});

describe("projects (D142)", () => {
  it("opening a project builds a fresh canvas and tells the app", () => {
    const session = createSession({ clock: createManualClock() });
    const first = session.canvas();
    let told = 0;
    session.onCanvas(() => told++);
    const second = session.open();
    expect(second).not.toBe(first);
    expect(session.canvas()).toBe(second);
    expect(session.story).toBe(second.story);
    expect(told).toBe(1);
  });

  it("opened from the bridge's link, projects go through its HTTP API", () => {
    const session = createSession({
      clock: createManualClock(),
      bridgeUrl: "ws://127.0.0.1:4321/?token=abc",
      search: "?ws=4321&token=abc",
    });
    expect(session.http).toBeDefined();
  });
});

describe("your handwriting examples (D174)", () => {
  const example = (id: string): HandwritingExample => ({
    id,
    label: "A",
    strokes: [{ t: 0, points: [[0, 0, 0.5, 0]] }],
    from: "you",
    at: "2026-11-25T10:00:00.000Z",
  });

  it("are loaded from the bridge, and saved once a moment after a burst of teaching", async () => {
    const clock = createManualClock();
    const saved: HandwritingExamples[] = [];
    const http = {
      readExamples: async () => ({ version: 1 as const, examples: [example("old")] }),
      saveExamples: async (e: HandwritingExamples) => void saved.push(e),
    } as unknown as BridgeHttp;
    const book = createExampleBook();
    keepExamples(book, http, clock);
    await Promise.resolve();
    expect(book.all().map((e) => e.id)).toEqual(["old"]);
    book.add(example("a"));
    book.add(example("b"));
    expect(saved).toHaveLength(0);
    clock.advance(SAVE_EXAMPLES_MS);
    expect(saved.map((s) => s.examples.map((e) => e.id))).toEqual([["old", "a", "b"]]);
  });
});

describe("moving to another project", () => {
  it("tells Claude first, and ends a wait still open on the old canvas", async () => {
    const session = createSession({ clock: createManualClock() });
    const old = session.canvas();
    const waiting = old.handler("wait_for_event", { timeoutMs: 60_000 }) as Promise<{
      timedOut: boolean;
    }>;
    const next = session.open(undefined, { id: "p2", name: "Hello" });

    await expect(waiting).resolves.toMatchObject({ timedOut: true });
    expect(next.story.unread()).toEqual([
      expect.objectContaining({
        type: "project",
        detail: { id: "p2", name: "Hello", opened: "new", objects: 0 },
      }),
    ]);
  });

  it("a saved project's own events stay read; only the project event is new", () => {
    const session = createSession({ clock: createManualClock() });
    session.canvas().story.append({ who: "user", type: "stroke" });
    const parts = {
      events: session.canvas().story.all(),
      strokes: [],
      objects: [],
      usedIds: [],
      history: { hidden: [], saved: [] },
    };
    const next = session.open(parts, { id: "p1", name: "Old" });
    expect(next.story.unread().map((e) => e.type)).toEqual(["project"]);
    expect(next.story.unread()[0]?.detail).toMatchObject({ opened: "saved" });
  });

  it("without a project, nothing is sent (the canvas the page starts with)", () => {
    const session = createSession({ clock: createManualClock() });
    expect(session.open().story.unread()).toEqual([]);
  });
});
