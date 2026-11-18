// How the bridge reaches the canvas tab. The WebSocket session (T16) implements it;
// until a tab connects, every canvas call answers no_canvas (D90).
import { ContractError, type BrowserCall } from "@visthinker/contract";

export interface CanvasLink {
  /** Passes a call to the canvas and resolves with its answer, or throws a ContractError. */
  call(name: BrowserCall, args: unknown, timeoutMs?: number): Promise<unknown>;
}

export const NO_CANVAS: CanvasLink = {
  call: async () => {
    throw new ContractError("no_canvas", "No canvas tab is connected. Open the canvas first.");
  },
};
