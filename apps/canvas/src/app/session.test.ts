import { createManualClock, placeObject } from "@visthinker/core";
import { describe, expect, it } from "vitest";
import { createSystemClock } from "../adapters/system-clock/index.ts";
import { createSession } from "./session.ts";

describe("composition root (D83)", () => {
  it("wires the core to a port for each need; transport and packs are still fakes", () => {
    const session = createSession(createManualClock());
    expect(session.fakes).toEqual(["transport", "packs"]);
    expect(session.transport.status()).toBe("ready");
    expect(session.packs.names()).toEqual([]);
  });

  it("stamps the story from the session clock", () => {
    const clock = createManualClock();
    const { story } = createSession(clock);
    clock.advance(40);
    expect(story.append({ who: "user", type: "stroke" }).t).toBe(40);
  });

  it("each session starts its own story and scene", () => {
    const a = createSession(createManualClock());
    const b = createSession(createManualClock());
    a.story.append({ who: "user", type: "stroke" });
    a.scene.nextId("l");
    expect(b.story.all()).toHaveLength(0);
    expect(b.scene.nextId("l")).toBe("l1");
  });
});

describe("renderer (T13)", () => {
  it("each new event pushes the current scene to the screen", () => {
    const session = createSession(createManualClock());
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
