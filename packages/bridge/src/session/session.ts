// One Claude session's link to one canvas tab (D82): listen on 127.0.0.1 only, a secret token
// per session, an Origin check, and at most one tab at a time. Implements CanvasLink (D90).
import { CALL_TIMEOUT_MS, ContractError, type BrowserCall } from "@visthinker/contract";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import type { CanvasLink } from "../canvas.ts";
import { log } from "../log.ts";
import { Tab } from "./tab.ts";

export interface SessionOptions {
  /** 0 picks a free port. */
  port?: number;
  /** Extra Origins allowed besides the bridge's own, e.g. a Vite dev server. */
  extraOrigins?: string[];
  callTimeoutMs?: number;
}

/** D82 ①: never 0.0.0.0, so nothing outside this computer can reach the bridge. */
export const HOST = "127.0.0.1";

/** WebSocket close codes the canvas can show, since a browser can't read an HTTP status. */
export const CLOSE_BAD_TOKEN = 4401;
export const CLOSE_TAB_TAKEN = 4409;
export const BAD_TOKEN_REASON = "this canvas link is not valid for this session";
export const TAB_TAKEN_REASON = "another canvas tab is connected";

function refuse(socket: Duplex, status: number, reason: string): void {
  log(`refused a tab: ${status} ${reason}`);
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

export class Session implements CanvasLink {
  /** D82 ②: a fresh secret for every session; it dies with the session (④). */
  readonly token = randomBytes(24).toString("base64url");
  readonly callTimeoutMs: number;
  #http: Server;
  #wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });
  #tab: Tab | undefined;
  #extraOrigins: string[];
  #port = 0;

  private constructor(options: SessionOptions) {
    this.callTimeoutMs = options.callTimeoutMs ?? CALL_TIMEOUT_MS;
    this.#extraOrigins = options.extraOrigins ?? [];
    // Serving the built canvas comes with open_canvas (T17); until then HTTP only upgrades.
    this.#http = createServer((_req, res) => {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("The Visthinker canvas is served from here once open_canvas exists (T17).\n");
    });
    this.#http.on("upgrade", (req, socket, head) => this.#onUpgrade(req, socket, head));
  }

  static async start(options: SessionOptions = {}): Promise<Session> {
    const session = new Session(options);
    await new Promise<void>((resolve, reject) => {
      session.#http.once("error", reject);
      session.#http.listen(options.port ?? 0, HOST, () => resolve());
    });
    const address = session.#http.address();
    if (!address || typeof address === "string") throw new Error("could not read the bridge port");
    session.#port = address.port;
    log(`listening on http://${HOST}:${session.#port}`);
    return session;
  }

  get port(): number {
    return this.#port;
  }

  /** The bridge's own Origin: the only page a tab may come from, unless an extra one is allowed. */
  get origin(): string {
    return `http://${HOST}:${this.#port}`;
  }

  /** The link the canvas opens with: the port and the token (D82 ②). */
  get url(): string {
    return `${this.origin}/?ws=${this.#port}&token=${this.token}`;
  }

  /** True while a tab is connected and past its handshake. */
  get hasCanvas(): boolean {
    return this.#tab?.ready ?? false;
  }

  /** Passes one call to the canvas and waits for its answer (D90). */
  call(call: BrowserCall, args: unknown, timeoutMs = this.callTimeoutMs): Promise<unknown> {
    if (!this.#tab?.ready) {
      return Promise.reject(
        new ContractError("no_canvas", "No canvas tab is connected. Open the canvas first."),
      );
    }
    return this.#tab.call(call, args, timeoutMs);
  }

  async close(): Promise<void> {
    this.#tab?.close();
    for (const client of this.#wss.clients) client.terminate();
    this.#wss.close();
    this.#http.closeAllConnections();
    await new Promise<void>((resolve) => this.#http.close(() => resolve()));
  }

  #tokenMatches(given: string | null): boolean {
    if (!given) return false;
    const a = Buffer.from(given);
    const b = Buffer.from(this.token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  #onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    // D82 ③: Origin first, so another website gets a bare 403 and learns nothing else.
    const origin = req.headers.origin;
    if (!origin || (origin !== this.origin && !this.#extraOrigins.includes(origin))) {
      return refuse(socket, 403, "Forbidden");
    }
    const token = new URL(req.url ?? "/", this.origin).searchParams.get("token");
    const refusal = !this.#tokenMatches(token)
      ? { code: CLOSE_BAD_TOKEN, reason: BAD_TOKEN_REASON }
      : this.#tab
        ? { code: CLOSE_TAB_TAKEN, reason: TAB_TAKEN_REASON } // D82 ④: one canvas per session
        : undefined;
    this.#wss.handleUpgrade(req, socket, head, (ws) => {
      if (refusal) {
        log(`refused a tab: ${refusal.code} ${refusal.reason}`);
        ws.close(refusal.code, refusal.reason);
        return;
      }
      const tab = new Tab(ws, () => {
        if (this.#tab === tab) this.#tab = undefined;
      });
      this.#tab = tab;
    });
  }
}
