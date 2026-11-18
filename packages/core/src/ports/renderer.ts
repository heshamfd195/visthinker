// The Renderer port: how the core shows the scene. The core hands over plain data;
// the Konva adapter (T13) decides how it looks. The core never imports Konva.
import type { SceneObject } from "@visthinker/contract";

export interface Renderer {
  /** Draw this scene. Called with the whole current scene each time it changes. */
  render(objects: readonly SceneObject[]): void;
}

/** A renderer for tests: keeps every frame it was asked to draw. */
export interface MemoryRenderer extends Renderer {
  frames(): SceneObject[][];
  last(): SceneObject[] | undefined;
}

export function createMemoryRenderer(): MemoryRenderer {
  const frames: SceneObject[][] = [];
  return {
    render(objects) {
      frames.push(objects.map((o) => structuredClone(o)));
    },
    frames: () => frames.map((frame) => frame.map((o) => structuredClone(o))),
    last() {
      const frame = frames.at(-1);
      return frame?.map((o) => structuredClone(o));
    },
  };
}
