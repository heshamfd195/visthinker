import type { SceneObject } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createSceneStore } from "./index.ts";

const line = (id: string): SceneObject => ({
  id,
  kind: "line",
  label: "",
  pack: "shapes",
  parts: [],
  relations: [],
  box: [0, 0, 1, 1],
  confidence: 1,
});

describe("scene store (D79)", () => {
  it("never hands out an id twice, even after a remove", () => {
    const store = createSceneStore();
    const l1 = store.nextId("l");
    store.add(line(l1), "user");
    store.remove(l1);
    expect(store.nextId("l")).toBe("l2");
    expect(store.nextId("x")).toBe("x1");
  });

  it("skips an id that was added by hand", () => {
    const store = createSceneStore();
    store.add(line("l1"), "user");
    expect(store.nextId("l")).toBe("l2");
    expect(() => store.add(line("l1"), "user")).toThrow();
  });

  it("removing an object drops every relation and part that points at it", () => {
    const store = createSceneStore();
    store.add(line("l1"), "user");
    store.add({ ...line("l2"), relations: [{ type: "crosses", to: "l1" }] }, "user");
    store.add({ ...line("g1"), kind: "group", parts: ["l1", "l2"] }, "fastbrain");
    store.remove("l1");
    expect(store.get("l2")?.relations).toEqual([]);
    expect(store.get("g1")?.parts).toEqual(["l2"]);
  });

  it("remembers who made each object", () => {
    const store = createSceneStore();
    store.add(line("l1"), "user");
    store.add({ ...line("n1"), kind: "note", label: "hi" }, "claude");
    expect([store.owner("l1"), store.owner("n1")]).toEqual(["user", "claude"]);
  });

  it("updates through a copy and refuses to change an id", () => {
    const store = createSceneStore();
    store.add(line("l1"), "user");
    store.update("l1", (o) => ({ ...o, label: "top" }));
    expect(store.get("l1")?.label).toBe("top");
    expect(() => store.update("l1", (o) => ({ ...o, id: "l9" }))).toThrow();
    expect(() => store.update("nope", (o) => o)).toThrow();
  });

  it("hands out copies, in the order objects were added", () => {
    const store = createSceneStore();
    store.add(line("l1"), "user");
    store.add(line("l2"), "user");
    store.all()[0]!.label = "changed";
    store.get("l1")!.label = "changed";
    expect(store.all().map((o) => [o.id, o.label])).toEqual([
      ["l1", ""],
      ["l2", ""],
    ]);
  });
});
