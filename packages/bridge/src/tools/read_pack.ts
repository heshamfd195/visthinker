import { defineTool } from "./types.ts";

export const readPack = defineTool({
  name: "read_pack",
  description:
    "Read a pack by name: its pack.json, rules.json and README.md. A local pack is read before a starter pack of the same name.",
  run: async ({ name }, ctx) => ({ pack: await ctx.packs.read(name) }),
});
