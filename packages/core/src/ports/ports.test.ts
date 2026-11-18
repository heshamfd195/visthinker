import type { Pack, SceneObject } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import {
  createManualClock,
  createMemoryPackSource,
  createMemoryRenderer,
  createMemoryTransport,
  type Clock,
  type PackSource,
  type Renderer,
  type Transport,
} from "./index.ts";

const line: SceneObject = {
  id: "l1",
  kind: "line",
  label: "",
  pack: "shapes",
  parts: [],
  relations: [],
  box: [0, 0, 1, 1],
  confidence: 1,
};

describe("Clock", () => {
  it("the manual clock moves only forward, and only when told", () => {
    const clock = createManualClock(100);
    expect(clock.now()).toBe(100);
    clock.advance(50);
    expect(clock.now()).toBe(150);
    expect(() => clock.advance(-1)).toThrow();
  });

  it("fires timers in time order, each at its own moment, and a cancelled one never", () => {
    const clock = createManualClock();
    const fired: [string, number][] = [];
    clock.after(300, () => fired.push(["late", clock.now()]));
    clock.after(100, () => fired.push(["early", clock.now()]));
    const cancel = clock.after(200, () => fired.push(["cancelled", clock.now()]));
    cancel();
    clock.advance(250);
    expect(fired).toEqual([["early", 100]]);
    clock.advance(100);
    expect(fired).toEqual([
      ["early", 100],
      ["late", 300],
    ]);
    expect(clock.now()).toBe(350);
  });
});

describe("Renderer", () => {
  it("the memory renderer keeps each frame as a copy", () => {
    const renderer = createMemoryRenderer();
    expect(renderer.last()).toBeUndefined();
    const scene = [line];
    renderer.render(scene);
    scene[0]!.label = "changed";
    renderer.render([]);
    expect(renderer.frames().map((f) => f.map((o) => o.label))).toEqual([[""], []]);
    expect(renderer.last()).toEqual([]);
  });
});

describe("Transport (D90)", () => {
  it("passes Claude's calls to whoever serves them, and returns the answer", async () => {
    const transport = createMemoryTransport();
    const seen: string[] = [];
    transport.serve(async (call, args) => {
      seen.push(call);
      return { echo: args };
    });
    await expect(transport.call("get_scene", {})).resolves.toEqual({ echo: {} });
    expect(seen).toEqual(["get_scene"]);
  });

  it("refuses calls when nothing serves or it isn't ready", async () => {
    const transport = createMemoryTransport();
    await expect(transport.call("get_scene", {})).rejects.toThrow("nothing is serving");
    const stop = transport.serve(async () => ({}));
    transport.setStatus("busy");
    await expect(transport.call("get_scene", {})).rejects.toThrow("busy");
    transport.setStatus("ready");
    stop();
    await expect(transport.call("get_scene", {})).rejects.toThrow("nothing is serving");
  });

  it("tells listeners about each status change once", () => {
    const transport = createMemoryTransport();
    const seen: string[] = [];
    const off = transport.onStatus((s) => seen.push(s));
    transport.setStatus("connecting");
    transport.setStatus("connecting");
    transport.setStatus("ready");
    off();
    transport.close();
    expect(seen).toEqual(["connecting", "ready"]);
    expect(transport.status()).toBe("closed");
  });
});

describe("PackSource", () => {
  it("lists packs by name and hands out copies of their files", () => {
    const pack = {
      "pack.json": {
        name: "shapes",
        version: "0.1.0",
        contract: "0",
        match: {},
        blocks: ["alphabet"],
      },
    } as Pack;
    const source = createMemoryPackSource([pack]);
    expect(source.names()).toEqual(["shapes"]);
    (source.read("shapes") as Pack)["pack.json"].version = "9.9.9";
    expect((source.read("shapes") as Pack)["pack.json"].version).toBe("0.1.0");
    expect(source.read("chess")).toBeUndefined();
  });

  it("can hold raw, unchecked files to test the loader's checks", () => {
    const source = createMemoryPackSource({ broken: { "pack.json": { name: 7 } } });
    expect(source.read("broken")).toEqual({ "pack.json": { name: 7 } });
  });
});

describe("the fakes fit their ports", () => {
  it("each fake can stand in where the port is expected (Liskov, D83)", () => {
    const ports: [Clock, Renderer, Transport, PackSource] = [
      createManualClock(),
      createMemoryRenderer(),
      createMemoryTransport(),
      createMemoryPackSource(),
    ];
    expect(ports).toHaveLength(4);
  });
});
