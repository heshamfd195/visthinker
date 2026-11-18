import type { SceneObject } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createReactRenderer } from "./index.ts";

const box: SceneObject = {
  id: "b1",
  kind: "box",
  label: "box",
  pack: "builtin",
  parts: [],
  relations: [],
  box: [0, 0, 10, 10],
  confidence: 1,
};

describe("react renderer (T13)", () => {
  it("starts with an empty frame", () => {
    expect(createReactRenderer().frame()).toEqual([]);
  });

  it("keeps the same frame between pushes, so React only re-renders on a push", () => {
    const renderer = createReactRenderer();
    renderer.render([box]);
    const first = renderer.frame();
    expect(renderer.frame()).toBe(first);
    renderer.render([box]);
    expect(renderer.frame()).not.toBe(first);
  });

  it("copies what it's given, so the core's scene can't change the frame", () => {
    const renderer = createReactRenderer();
    const scene = [{ ...box }];
    renderer.render(scene);
    scene[0]!.label = "changed";
    expect(renderer.frame()[0]!.label).toBe("box");
  });

  it("tells subscribers about each push until they unsubscribe", () => {
    const renderer = createReactRenderer();
    let calls = 0;
    const off = renderer.subscribe(() => calls++);
    renderer.render([box]);
    off();
    renderer.render([]);
    expect(calls).toBe(1);
  });
});
