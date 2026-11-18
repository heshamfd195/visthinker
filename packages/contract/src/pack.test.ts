import { describe, expect, it } from "vitest";
import { Pack } from "./index.ts";

const ticTacToe = {
  "pack.json": {
    name: "tic-tac-toe",
    version: "0.1.0",
    contract: "0",
    match: { lines: 4, crossings: 4, layout: "two-by-two" },
    blocks: ["grid", "turns", "line-of"],
  },
  "rules.json": {
    grid: { from: "crossings", rows: 3, cols: 3, ids: "c1..c9" },
    turns: { order: ["user", "claude"], marks: { user: "X", claude: "O" } },
    "line-of": {
      length: 3,
      win: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [1, 4, 7],
        [2, 5, 8],
        [3, 6, 9],
        [1, 5, 9],
        [3, 5, 7],
      ],
    },
  },
  "README.md": "# Tic-tac-toe\n\nThe user plays X, Claude plays O. Three in a row wins.\n",
};
const manifest = ticTacToe["pack.json"];

describe("Pack (D92)", () => {
  it("the tic-tac-toe pack is valid", () => {
    expect(Pack.parse(ticTacToe)).toEqual(ticTacToe);
  });

  it("needs only pack.json; rules and README are optional", () => {
    expect(Pack.safeParse({ "pack.json": manifest }).success).toBe(true);
  });

  it("refuses rules for a block pack.json doesn't list", () => {
    const bad = { ...ticTacToe, "pack.json": { ...manifest, blocks: ["grid"] } };
    const result = Pack.safeParse(bad);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join("."))).toEqual(
      expect.arrayContaining(["rules.json.turns", "rules.json.line-of"]),
    );
  });

  it("refuses another contract version, a bad name and a non-semver version", () => {
    for (const change of [{ contract: "1" }, { name: "Tic Tac Toe" }, { version: "1.0" }]) {
      expect(Pack.safeParse({ "pack.json": { ...manifest, ...change } }).success).toBe(false);
    }
  });

  it("lets a pack wire a block the core may add later", () => {
    const pack = {
      "pack.json": { ...manifest, blocks: ["grid", "timer"] },
      "rules.json": { timer: { seconds: 30 } },
    };
    expect(Pack.safeParse(pack).success).toBe(true);
  });
});
