import { log } from "../log.ts";
import { defineTool } from "./types.ts";

export const listPacks = defineTool({
  name: "list_packs",
  description:
    "List the packs you can read or install: the starter packs, the ones saved in ~/.visthinker/packs, and the Visthinker API's catalog when it's set up (name, version, source: starter, local or api).",
  run: async (_args, ctx) => {
    const own = await ctx.packs.list();
    if (!ctx.api) return { packs: own };
    try {
      const api = (await ctx.api.list()).map((p) => ({
        name: p.name,
        version: p.version,
        source: "api" as const,
      }));
      return { packs: [...own, ...api] };
    } catch (error) {
      // The API being down never hides the packs already on this machine.
      log("list_packs: the API's catalog is unavailable:", String(error));
      return { packs: own };
    }
  },
});
