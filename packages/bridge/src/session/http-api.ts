// The canvas's own small HTTP API on the bridge (D142 · D143 · D122): projects and behaviour
// settings on disk, and the packs panel's list and install. The WebSocket stays answer-only
// (D90); the page asks for these with the session's token, from an allowed Origin only.
import { ContractError } from "@visthinker/contract";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ProjectStore } from "../projects/store.ts";
import { installPack } from "../tools/install_pack.ts";
import { listPacks } from "../tools/list_packs.ts";
import { readPack } from "../tools/read_pack.ts";
import type { BridgeContext } from "../tools/types.ts";

/** A project can be a few megabytes of ink; anything larger is refused. */
export const MAX_BODY = 16 * 1024 * 1024;

export type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const STATUS: Record<string, number> = {
  bad_args: 400,
  unknown_target: 404,
  not_allowed: 403,
  bad_contract: 422,
  no_canvas: 409,
  timeout: 504,
};

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new ContractError("bad_args", "the request is too large");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new ContractError("bad_args", "the request isn't valid JSON");
  }
}

export function createHttpApi(ctx: BridgeContext, home: string): ApiHandler {
  const projects = new ProjectStore(home);
  return async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const parts = url.pathname.split("/").filter(Boolean).slice(1); // after "api"
    const method = req.method ?? "GET";
    try {
      const [area, name, action] = parts;
      if (area === "projects" && !name && method === "GET") {
        return send(res, 200, { projects: await projects.list() });
      }
      if (area === "projects" && name && method === "GET") {
        return send(res, 200, await projects.read(name));
      }
      if (area === "projects" && name && method === "PUT") {
        const body = (await readBody(req)) as { meta?: { id?: unknown } };
        if (body.meta?.id !== name) throw new ContractError("bad_args", "the id doesn't match");
        return send(res, 200, { meta: await projects.save(body) });
      }
      if (area === "settings" && method === "GET") {
        return send(res, 200, await projects.readSettings());
      }
      if (area === "settings" && method === "PUT") {
        return send(res, 200, await projects.saveSettings(await readBody(req)));
      }
      if (area === "packs" && !name && method === "GET") {
        return send(res, 200, await listPacks.run({}, ctx));
      }
      if (area === "packs" && name && !action && method === "GET") {
        return send(res, 200, await readPack.run({ name }, ctx));
      }
      if (area === "packs" && name && action === "install" && method === "POST") {
        return send(res, 200, await installPack.run({ name }, ctx));
      }
      send(res, 404, { error: { code: "unknown_call", message: "no such API" } });
    } catch (error) {
      const code = error instanceof ContractError ? error.code : "internal";
      const message = error instanceof Error ? error.message : String(error);
      send(res, STATUS[code] ?? 500, { error: { code, message: message.slice(0, 1_000) } });
    }
  };
}
