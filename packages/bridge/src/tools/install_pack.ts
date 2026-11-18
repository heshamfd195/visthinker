import { ContractError, Pack } from "@visthinker/contract";
import { defineTool } from "./types.ts";

export const installPack = defineTool({
  name: "install_pack",
  description:
    "Install a pack by name from the Visthinker API: it is checked, saved to ~/.visthinker/packs and loaded into the canvas if one is open. Without the API, write the pack yourself with write_pack.",
  run: async ({ name }, ctx) => {
    if (!ctx.api) {
      throw new ContractError(
        "not_allowed",
        `install_pack needs the Visthinker API (VISTHINKER_API isn't set), so ${name} can't be installed. Write the pack with write_pack.`,
      );
    }
    const parsed = Pack.safeParse(await ctx.api.read(name));
    if (!parsed.success) {
      throw new ContractError(
        "bad_contract",
        `the API's pack ${name} isn't valid, so it wasn't installed: ${parsed.error.message.slice(0, 800)}`,
      );
    }
    const pack = parsed.data;
    await ctx.packs.save(pack);
    const { version } = pack["pack.json"];
    try {
      await ctx.canvas.call("write_pack", { pack });
    } catch (error) {
      // Saved either way; with no canvas open it simply isn't loaded yet.
      if (!(error instanceof ContractError) || error.code !== "no_canvas") throw error;
    }
    return { name: pack["pack.json"].name, version };
  },
});
