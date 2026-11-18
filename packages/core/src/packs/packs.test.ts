import { Pack, type SceneObject } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createPackRegistry, loadPack, matchPack, STARTER_PACKS, unknownBlocks } from "./index.ts";

const manifest = {
  name: "noughts",
  version: "0.1.0",
  contract: "0",
  match: {},
  blocks: ["grid", "timer"],
};

describe("loadPack (D92)", () => {
  it("returns a valid pack, checked by the contract", () => {
    expect(Pack.parse(loadPack({ "pack.json": manifest }))).toEqual({ "pack.json": manifest });
  });

  it("refuses a bad one with where and why", () => {
    expect(() => loadPack({ "pack.json": { ...manifest, version: "1" } })).toThrow(
      /pack\.json\.version/,
    );
    expect(() =>
      loadPack({ "pack.json": manifest, "rules.json": { turns: { order: ["user"], marks: {} } } }),
    ).toThrow();
    try {
      loadPack({});
    } catch (error) {
      expect(error).toMatchObject({ code: "bad_args" });
    }
  });

  it("names the blocks this core doesn't ship yet", () => {
    expect(unknownBlocks(loadPack({ "pack.json": manifest }))).toEqual(["timer"]);
  });
});

describe("starter packs (D74)", () => {
  it("shapes and tic-tac-toe are built in and pass the same check", () => {
    expect(STARTER_PACKS.map((p) => p["pack.json"].name)).toEqual(["shapes", "tic-tac-toe"]);
    expect(unknownBlocks(STARTER_PACKS[1]!)).toEqual([]);
  });
});

describe("the registry", () => {
  it("starts with the starter packs, and a newer load replaces the older", () => {
    const registry = createPackRegistry(STARTER_PACKS);
    expect(registry.names()).toEqual(["shapes", "tic-tac-toe"]);
    registry.load({
      "pack.json": { ...manifest, name: "tic-tac-toe", version: "0.9.0", blocks: ["grid"] },
    });
    expect(registry.get("tic-tac-toe")!.pack["pack.json"].version).toBe("0.9.0");
    expect(registry.names()).toHaveLength(2);
  });

  it("a bad pack is refused and doesn't replace a good one", () => {
    const registry = createPackRegistry(STARTER_PACKS);
    expect(() => registry.load({ "pack.json": { name: "tic-tac-toe" } })).toThrow();
    expect(registry.get("tic-tac-toe")!.pack["pack.json"].version).toBe("0.1.0");
  });
});

describe("matchPack (D68)", () => {
  const base = {
    label: "",
    pack: "shapes",
    parts: [],
    box: [0, 0, 0, 0] as SceneObject["box"],
    confidence: 1,
  };
  const line = (id: string, a: [number, number], b: [number, number]): SceneObject => ({
    ...base,
    id,
    kind: "line",
    relations: [],
    geom: { a, b },
  });
  const crossing = (id: string, at: [number, number], on: [string, string]): SceneObject => ({
    ...base,
    id,
    kind: "crossing",
    relations: on.map((to) => ({ type: "on", to })),
    geom: { at },
  });
  const hash = [
    line("v1", [150, 0], [150, 300]),
    line("v2", [250, 0], [250, 300]),
    line("h1", [0, 100], [400, 100]),
    line("h2", [0, 160], [400, 160]),
    crossing("a", [150, 100], ["v1", "h1"]),
    crossing("b", [250, 100], ["h1", "v2"]),
    crossing("c", [150, 160], ["v1", "h2"]),
    crossing("d", [250, 160], ["v2", "h2"]),
  ];
  const ttt = STARTER_PACKS[1]!["pack.json"].match;

  it("a # of 4 lines and 4 crossings in a two-by-two layout is tic-tac-toe", () => {
    expect(matchPack(ttt, hash)).toEqual({ ok: true });
  });

  it("says why not: too few lines, or an unknown layout", () => {
    expect(matchPack(ttt, hash.slice(1))).toEqual({
      ok: false,
      reason: "3 lines, the pack looks for 4",
    });
    expect(matchPack({ layout: "spiral" }, hash)).toEqual({
      ok: false,
      reason: 'unknown layout "spiral"',
    });
  });

  it("an empty match matches anything (shapes is always on)", () => {
    expect(matchPack({}, [])).toEqual({ ok: true });
  });
});
