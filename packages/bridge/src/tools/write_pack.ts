import { comingTool } from "./types.ts";

export const writePack = comingTool(
  "write_pack",
  'Write a pack (pack.json, optional rules.json and README.md), save it to ~/.visthinker/packs/<name>/ and load it into the canvas. pack.json needs name, version, contract "0", match and blocks; rules.json may only have keys listed in blocks.',
  "T24",
);
