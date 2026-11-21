// The bridge's small HTTP API (D142 · D143 · D122): projects and settings on disk, packs.
// Same session token as the WebSocket (D82), sent as a Bearer header, never in the URL.
import { BehaviourSettings, Pack, Project, ProjectMeta } from "@visthinker/contract";

export interface PackListing {
  name: string;
  version: string;
  source: "starter" | "local" | "api";
}

export interface BridgeHttp {
  listProjects(): Promise<ProjectMeta[]>;
  readProject(id: string): Promise<Project>;
  saveProject(project: Project): Promise<void>;
  readSettings(): Promise<BehaviourSettings>;
  saveSettings(settings: BehaviourSettings): Promise<BehaviourSettings>;
  listPacks(): Promise<PackListing[]>;
  readPack(name: string): Promise<Pack>;
  installPack(name: string): Promise<void>;
}

/** Reads `?ws=<port>&token=<token>`: the bridge's HTTP base and token, or null without a bridge. */
export function bridgeHttpFromPage(search: string): { base: string; token: string } | null {
  const params = new URLSearchParams(search);
  const port = params.get("ws");
  const token = params.get("token");
  if (!port || !/^\d{1,5}$/.test(port) || !token) return null;
  return { base: `http://127.0.0.1:${port}/api`, token };
}

export class BridgeHttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const SOURCES = new Set(["starter", "local", "api"]);

/** Keeps only well-formed rows of the bridge's pack list. */
export function readPackList(body: unknown): PackListing[] {
  const packs = (body as { packs?: unknown } | null)?.packs;
  if (!Array.isArray(packs)) throw new Error("the bridge sent no pack list");
  return packs.filter(
    (p): p is PackListing =>
      typeof p?.name === "string" && typeof p?.version === "string" && SOURCES.has(p?.source),
  );
}

export function createBridgeHttp(
  { base, token }: { base: string; token: string },
  fetcher: typeof fetch = (...args) => fetch(...args),
): BridgeHttp {
  const call = async (path: string, init: RequestInit = {}): Promise<unknown> => {
    const res = await fetcher(`${base}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    if (!res.ok) {
      throw new BridgeHttpError(
        res.status,
        body.error?.code ?? "internal",
        body.error?.message ?? `the bridge answered ${res.status}`,
      );
    }
    return body;
  };
  return {
    listProjects: async () =>
      ProjectMeta.array().parse(
        ((await call("projects")) as { projects?: unknown }).projects ?? [],
      ),
    readProject: async (id) => Project.parse(await call(`projects/${encodeURIComponent(id)}`)),
    async saveProject(project) {
      await call(`projects/${encodeURIComponent(project.meta.id)}`, {
        method: "PUT",
        body: JSON.stringify(project),
      });
    },
    readSettings: async () => BehaviourSettings.parse(await call("settings")),
    saveSettings: async (settings) =>
      BehaviourSettings.parse(
        await call("settings", { method: "PUT", body: JSON.stringify(settings) }),
      ),
    listPacks: async () => readPackList(await call("packs")),
    readPack: async (name) =>
      Pack.parse(((await call(`packs/${encodeURIComponent(name)}`)) as { pack?: unknown }).pack),
    async installPack(name) {
      await call(`packs/${encodeURIComponent(name)}/install`, { method: "POST" });
    },
  };
}
