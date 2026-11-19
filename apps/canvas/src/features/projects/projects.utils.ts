// Pure helpers for the projects drawer (D125): when a project was last used, new projects and chats.
import type { ChatMeta, ProjectMeta } from "@visthinker/contract";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "now", "5 min", "2 h", "yesterday" or "3 days": how long ago `ms` was, seen from `now`. */
export function ago(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  if (diff < MIN) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h`;
  if (diff < 2 * DAY) return "yesterday";
  return `${Math.floor(diff / DAY)} days`;
}

/** A short id matching the contract's /^[a-z0-9-]{1,40}$/: time and a little randomness, base 36. */
export function newId(now: number): string {
  return `${Math.max(0, Math.floor(now)).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A new chat inside the open project (D125). */
export function newChat(now: number): ChatMeta {
  return { id: newId(now), name: "New chat", createdAt: now };
}

/** A new project: one canvas with its first chat, "main" (D125). */
export function newProjectMeta(name: string, now: number, id: string = newId(now)): ProjectMeta {
  const clean = name.trim().slice(0, 80) || "Untitled";
  return { id, name: clean, updatedAt: now, chats: [{ id: "main", name: "Chat", createdAt: now }] };
}

/** Projects whose name holds the search, most recently used first. */
export function findProjects(projects: readonly ProjectMeta[], search: string): ProjectMeta[] {
  const q = search.trim().toLowerCase();
  return projects
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
