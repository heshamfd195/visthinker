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
  it("ships tic-tac-toe and shapes, each folder named after its pack", async () => {
    const folders = (await readdir(PACKS, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(folders.sort()).toEqual(["shapes", "tic-tac-toe"]);
    for (const name of folders) {
      expect(Pack.parse(await readPack(name))["pack.json"].name).toBe(name);
    }
  });

  it("every pack explains itself in a README", async () => {
    for (const name of ["shapes", "tic-tac-toe"]) {
      expect(String((await readPack(name))["README.md"]).length).toBeGreaterThan(200);
    }
  });
});

describe("tic-tac-toe (D80 · D92)", () => {
  it("is found by 4 lines and 4 crossings in a two-by-two layout (D68)", async () => {
    const pack = Pack.parse(await readPack("tic-tac-toe"));
    expect(pack["pack.json"].match).toEqual({ lines: 4, crossings: 4, layout: "two-by-two" });
    expect(pack["pack.json"].blocks).toEqual(["grid", "turns", "line-of"]);
  });

  it("you play X and go first; Claude plays O", async () => {
    const turns = Pack.parse(await readPack("tic-tac-toe"))["rules.json"]!.turns!;
    expect(turns).toEqual({ order: ["user", "claude"], marks: { user: "X", claude: "O" } });
  });

  it("lists all 8 win lines exactly once, each over cells 1–9", async () => {
    const lineOf = Pack.parse(await readPack("tic-tac-toe"))["rules.json"]!["line-of"]!;
    const lines = lineOf.win.map((l) => [...l].sort().join(","));
    expect(new Set(lines).size).toBe(8);
    for (const l of lineOf.win) {
      expect(l).toHaveLength(lineOf.length);
      expect(l.every((n) => n >= 1 && n <= 9)).toBe(true);
    }
    // 3 rows, 3 columns, 2 diagonals.
    expect(lines).toEqual(
      expect.arrayContaining([
        "1,2,3",
        "4,5,6",
        "7,8,9",
        "1,4,7",
        "2,5,8",
        "3,6,9",
        "1,5,9",
        "3,5,7",
      ]),
    );
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
