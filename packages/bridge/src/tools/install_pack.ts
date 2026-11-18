import { ContractError } from "@visthinker/contract";
import { defineTool } from "./types.ts";

export const installPack = defineTool({
  name: "install_pack",
  description:
    "Install a pack by name from the Visthinker API. Not available yet: write the pack yourself with write_pack.",
  run: async ({ name }) => {
    throw new ContractError(
      "not_allowed",
      `install_pack needs the Visthinker API, which isn't there yet, so ${name} can't be installed. Write the pack with write_pack.`,
    );
  },
});
