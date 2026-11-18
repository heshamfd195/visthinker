import { defineTool } from "./types.ts";

export const listPacks = defineTool({
  name: "list_packs",
  description:
    "List the packs you can read: the starter packs the app ships with, and the ones saved in ~/.visthinker/packs (name, version, source).",
  run: async (_args, ctx) => ({ packs: await ctx.packs.list() }),
});
