import { Pack } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createPackRegistry, loadPack, STARTER_PACKS, unknownBlocks } from "./index.ts";

const manifest = {
  name: "noughts",
  version: "0.1.0",
  contract: "0",
  match: {},
  blocks: ["symbol", "timer"],
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
  it("shapes and modes are built in and pass the same check", () => {
    expect(STARTER_PACKS.map((p) => p["pack.json"].name)).toEqual(["shapes", "modes"]);
    for (const pack of STARTER_PACKS) expect(unknownBlocks(pack)).toEqual([]);
  });
});

describe("the registry", () => {
  it("starts with the starter packs, and a newer load replaces the older", () => {
    const registry = createPackRegistry(STARTER_PACKS);
    expect(registry.names()).toEqual(["shapes", "modes"]);
    registry.load({
      "pack.json": { ...manifest, name: "shapes", version: "0.9.0", blocks: ["symbol"] },
    });
    expect(registry.get("shapes")!.pack["pack.json"].version).toBe("0.9.0");
    expect(registry.names()).toHaveLength(2);
  });

  it("a bad pack is refused and doesn't replace a good one", () => {
    const registry = createPackRegistry(STARTER_PACKS);
    expect(() => registry.load({ "pack.json": { name: "shapes" } })).toThrow();
    expect(registry.get("shapes")!.pack["pack.json"].version).toBe("0.1.0");
  });
});
