import type { ToolName } from "@visthinker/contract";
import { act } from "./act.ts";
import { answer } from "./answer.ts";
import { ask } from "./ask.ts";
import { getEvents } from "./get_events.ts";
import { getScene } from "./get_scene.ts";
import { getStrokes } from "./get_strokes.ts";
import { installPack } from "./install_pack.ts";
import { listPacks } from "./list_packs.ts";
import { openCanvas } from "./open_canvas.ts";
import { readPack } from "./read_pack.ts";
import { say } from "./say.ts";
import { setMode } from "./set_mode.ts";
import type { ToolDef } from "./types.ts";
import { waitForEvent } from "./wait_for_event.ts";
import { writePack } from "./write_pack.ts";

/** Every tool in the contract (D81), one file each. */
export const ALL_TOOLS: { [N in ToolName]: ToolDef<N> } = {
  open_canvas: openCanvas,
  get_events: getEvents,
  get_scene: getScene,
  get_strokes: getStrokes,
  wait_for_event: waitForEvent,
  act,
  say,
  ask,
  answer,
  set_mode: setMode,
  list_packs: listPacks,
  install_pack: installPack,
  read_pack: readPack,
  write_pack: writePack,
};
