// The real Renderer (T13): the core pushes each new scene here, and React draws it through
// react-konva. Calm parts stay declarative (D83); the core never imports Konva or React.
import type { SceneObject } from "@visthinker/contract";
import type { Renderer } from "@visthinker/core";

export interface ReactRenderer extends Renderer {
  /** The last scene pushed. The same array until the next push, as React's store contract asks. */
  frame(): readonly SceneObject[];
  /** Called after each push. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export function createReactRenderer(): ReactRenderer {
  let frame: readonly SceneObject[] = Object.freeze([]);
  const listeners = new Set<() => void>();
  return {
    render(objects) {
      frame = Object.freeze(objects.map((o) => structuredClone(o)));
      for (const listener of [...listeners]) listener();
    },
    frame: () => frame,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
