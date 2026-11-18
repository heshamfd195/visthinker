import { ContractError } from "@visthinker/contract";
import { defineTool } from "./types.ts";

export const openCanvas = defineTool({
  name: "open_canvas",
  description:
    "Open the shared Visthinker canvas in the user's browser and return its link. Call it first, and once: no new tab opens while one is connected, or while one opened in the last 20 s may still be loading. The other canvas tools answer no_canvas until the tab has connected, so wait a moment after opening.",
  run: async (_args, ctx) => {
    if (!ctx.opener) throw new ContractError("no_canvas", "this bridge has no canvas to open");
    const { url } = ctx.opener;
    if (ctx.opener.claimOpen()) await ctx.openBrowser(url);
    return { url };
  },
});
