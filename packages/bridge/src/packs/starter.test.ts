// The starter packs the app ships with (D74) must pass the same check as a pack Claude writes (D92).
import { Pack } from "@visthinker/contract";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKS = fileURLToPath(new URL("../../../../packs/", import.meta.url));

/** A pack folder as it travels in read_pack / write_pack: its files by name. */
async function readPack(name: string): Promise<Record<string, unknown>> {
  const dir = `${PACKS}${name}/`;
  const files: Record<string, unknown> = {
    "pack.json": JSON.parse(await readFile(`${dir}pack.json`, "utf8")),
  };
  const names = await readdir(dir);
  if (names.includes("rules.json"))
    files["rules.json"] = JSON.parse(await readFile(`${dir}rules.json`, "utf8"));
  if (names.includes("README.md")) files["README.md"] = await readFile(`${dir}README.md`, "utf8");
  return files;
}

describe("starter packs (D74)", () => {
  it("ships shapes and modes, each folder named after its pack", async () => {
    const folders = (await readdir(PACKS, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(folders.sort()).toEqual(["modes", "shapes"]);
    for (const name of folders) {
      expect(Pack.parse(await readPack(name))["pack.json"].name).toBe(name);
    }
  });

  it("every pack explains itself in a README", async () => {
    for (const name of ["modes", "shapes"]) {
      expect(String((await readPack(name))["README.md"]).length).toBeGreaterThan(200);
    }
  });
});

describe("shapes", () => {
  it("is always loaded (empty match) and holds 16 X and O templates", async () => {
    const pack = Pack.parse(await readPack("shapes"));
    expect(pack["pack.json"].match).toEqual({});
    const symbol = pack["rules.json"]!["symbol"] as {
      templates: { label: string }[];
      points: number;
      threshold: number;
    };
    expect(symbol.points).toBe(32);
    const labels = symbol.templates.map((t) => t.label);
    expect([
      labels.filter((l) => l === "X").length,
      labels.filter((l) => l === "O").length,
    ]).toEqual([10, 6]);
  });
});
