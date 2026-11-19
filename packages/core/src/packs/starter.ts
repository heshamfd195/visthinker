// The packs that ship with the app (D74), straight from the repo's packs/ folder: data only.
import type { Pack } from "@visthinker/contract";
import shapesManifest from "../../../../packs/shapes/pack.json" with { type: "json" };
import shapesRules from "../../../../packs/shapes/rules.json" with { type: "json" };
import tttManifest from "../../../../packs/tic-tac-toe/pack.json" with { type: "json" };
import tttRules from "../../../../packs/tic-tac-toe/rules.json" with { type: "json" };
import modesManifest from "../../../../packs/modes/pack.json" with { type: "json" };
import modesRules from "../../../../packs/modes/rules.json" with { type: "json" };
import { loadPack } from "./loader.ts";

/** `shapes` (always loaded), `tic-tac-toe` and `modes` (D139), checked like any other pack. */
export const STARTER_PACKS: readonly Pack[] = [
  loadPack({ "pack.json": shapesManifest, "rules.json": shapesRules }),
  loadPack({ "pack.json": tttManifest, "rules.json": tttRules }),
  loadPack({ "pack.json": modesManifest, "rules.json": modesRules }),
];
