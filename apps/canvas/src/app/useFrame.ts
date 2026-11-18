import type { SceneObject } from "@visthinker/contract";
import { useSyncExternalStore } from "react";
import type { ReactRenderer } from "../adapters/react-renderer/index.ts";

/** The scene the core last pushed through the renderer port. */
export function useFrame(renderer: ReactRenderer): readonly SceneObject[] {
  return useSyncExternalStore(renderer.subscribe, renderer.frame);
}
