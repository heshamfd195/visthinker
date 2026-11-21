import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PackStore, visthinkerHome } from "./store.ts";

const pack = (name: string, version = "0.1.0") =>
  ({ "pack.json": { name, version, contract: "0", match: {}, blocks: ["symbol"] } }) as never;

const store = async () => new PackStore(await mkdtemp(join(tmpdir(), "visthinker-home-")));

describe("pack store (D93)", () => {
  it("keeps local packs in <home>/packs, one folder each", async () => {
    const packs = await store();
    const folder = await packs.save(pack("noughts"));
    expect(folder).toBe(join(packs.dir, "noughts"));
    expect(await readdir(folder)).toEqual(["pack.json"]);
  });

  it("saving again replaces the older version, leaving no temp folder", async () => {
    const packs = await store();
    await packs.save(pack("noughts", "0.1.0"));
    await packs.save(pack("noughts", "0.2.0"));
    expect((await packs.read("noughts"))["pack.json"].version).toBe("0.2.0");
    expect(await readdir(packs.dir)).toEqual(["noughts"]);
  });

  it("a local pack is read before a starter pack of the same name", async () => {
    const packs = await store();
    expect((await packs.read("shapes"))["pack.json"].version).toBe("0.1.0");
    await packs.save(pack("shapes", "2.0.0"));
    expect((await packs.read("shapes"))["pack.json"].version).toBe("2.0.0");
  });

  it("a name that isn't a pack name can't reach outside the folder", async () => {
    const packs = await store();
    await expect(packs.read("../../etc")).rejects.toMatchObject({ code: "bad_args" });
    expect(() => packs.folderOf("Two Words")).toThrow();
  });

  it("a broken pack on disk is skipped in the list and refused on read", async () => {
    const packs = await store();
    await mkdir(join(packs.dir, "broken"), { recursive: true });
    await writeFile(join(packs.dir, "broken", "pack.json"), "{ not json");
    expect((await packs.list()).map((p) => p.name)).toEqual(["modes", "shapes"]);
    await expect(packs.read("broken")).rejects.toMatchObject({ code: "bad_contract" });
  });

  it("home is ~/.visthinker unless VISTHINKER_HOME says otherwise", () => {
    expect(visthinkerHome({ VISTHINKER_HOME: "/tmp/v" })).toBe("/tmp/v");
    expect(visthinkerHome({})).toMatch(/\.visthinker$/);
  });
});
