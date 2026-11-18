// `npx visthinker`: the bridge, with the built canvas and the starter packs beside this file.
// Claude Code starts it with: claude mcp add visthinker -- npx visthinker
import { main } from "@visthinker/bridge";
import { fileURLToPath } from "node:url";

const beside = (path: string) => fileURLToPath(new URL(path, import.meta.url));

main({ canvasDir: beside("../canvas/"), starterDir: beside("../packs/") }).catch(
  (error: unknown) => {
    process.stderr.write(`[visthinker] failed to start: ${String(error)}\n`);
    process.exit(1);
  },
);
