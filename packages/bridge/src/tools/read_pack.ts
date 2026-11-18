import { ContractError, Pack } from "@visthinker/contract";
import { defineTool } from "./types.ts";

export const readPack = defineTool({
  name: "read_pack",
  description:
    "Read a pack by name: its pack.json, rules.json and README.md. A local pack comes first, then a starter pack, then the Visthinker API's.",
  run: async ({ name }, ctx) => {
    try {
      return { pack: await ctx.packs.read(name) };
    } catch (error) {
      if (!(error instanceof ContractError) || error.code !== "unknown_target" || !ctx.api)
        throw error;
    }
    const parsed = Pack.safeParse(await ctx.api.read(name));
    if (!parsed.success)
      throw new ContractError(
        "bad_contract",
        `the API's pack ${name} isn't valid: ${parsed.error.message.slice(0, 800)}`,
      );
    return { pack: parsed.data };
  },
});
