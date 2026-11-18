import { ContractError } from "@visthinker/contract";
import { defineTool } from "./types.ts";

export const writePack = defineTool({
  name: "write_pack",
  description:
    'Write a pack (pack.json, optional rules.json and README.md), save it to ~/.visthinker/packs/<name>/ and load it into the canvas. pack.json needs name, version, contract "0", match and blocks; rules.json may only have keys listed in blocks. loaded is false when no canvas is open (the pack is still saved).',
  run: async ({ pack }, ctx) => {
    const folder = await ctx.packs.save(pack);
    const { name, version } = pack["pack.json"];
    try {
      return (await ctx.canvas.call("write_pack", { pack })) as {
        name: string;
        version: string;
        loaded: boolean;
      };
    } catch (error) {
      if (error instanceof ContractError && error.code === "no_canvas")
        return { name, version, loaded: false };
      if (error instanceof ContractError) {
        throw new ContractError(
          error.code,
          `saved to ${folder}, but the canvas didn't load it: ${error.message}`,
        );
      }
      throw error;
    }
  },
});
