// Runs the bridge from the repo: node packages/bridge/src/bin.ts
// The published `visthinker` package has its own entry with the canvas and packs beside it.
import { log } from "./log.ts";
import { main } from "./server.ts";

main().catch((error) => {
  log("failed to start:", String(error));
  process.exit(1);
});
