import { ChatMeta, ProjectMeta } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { ago, findProjects, newChat, newId, newProjectMeta } from "./projects.utils.ts";

const NOW = Date.UTC(2026, 10, 19, 12);
const MIN = 60_000;

describe("ago", () => {
  it("says how long ago, in short words", () => {
    expect(ago(NOW, NOW)).toBe("now");
    expect(ago(NOW - 30_000, NOW)).toBe("now");
    expect(ago(NOW - 5 * MIN, NOW)).toBe("5 min");
    expect(ago(NOW - 59 * MIN, NOW)).toBe("59 min");
    expect(ago(NOW - 2 * 60 * MIN, NOW)).toBe("2 h");
    expect(ago(NOW - 30 * 60 * MIN, NOW)).toBe("yesterday");
    expect(ago(NOW - 3 * 24 * 60 * MIN, NOW)).toBe("3 days");
  });

  it("treats a time in the future as now", () => {
    expect(ago(NOW + 10 * MIN, NOW)).toBe("now");
  });
});

describe("new projects and chats", () => {
  it("makes ids the contract accepts", () => {
    for (let i = 0; i < 50; i++) expect(newId(NOW + i)).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(newId(NOW)).not.toBe(newId(NOW));
  });

  it("starts a project with one chat, main", () => {
    const meta = newProjectMeta("  Tic tac toe  ", NOW);
    expect(ProjectMeta.parse(meta)).toEqual(meta);
    expect(meta).toMatchObject({ name: "Tic tac toe", updatedAt: NOW });
    expect(meta.chats).toEqual([{ id: "main", name: "Chat", createdAt: NOW }]);
  });

  it("keeps a given id and names an empty project", () => {
    expect(newProjectMeta("", NOW, "p1")).toMatchObject({ id: "p1", name: "Untitled" });
  });

  it("makes a valid new chat", () => {
    const chat = newChat(NOW);
    expect(ChatMeta.parse(chat)).toEqual(chat);
    expect(chat.createdAt).toBe(NOW);
  });
});

describe("findProjects", () => {
  const a = newProjectMeta("Games", NOW - MIN, "a");
  const b = newProjectMeta("Shapes study", NOW, "b");

  it("filters by name and puts the latest first", () => {
    expect(findProjects([a, b], "").map((p) => p.id)).toEqual(["b", "a"]);
    expect(findProjects([a, b], " GAM ").map((p) => p.id)).toEqual(["a"]);
    expect(findProjects([a, b], "zzz")).toEqual([]);
  });
});
