// The real Transport (T18): the canvas end of the bridge (D90). It connects with the session
// token (D82), says hello with the contract version, then answers each request through whoever
// serves calls. The browser never starts a call. It reconnects quietly after an ordinary drop and
// stops when the bridge refuses this tab, so extra tabs don't race for the one slot.
import {
  BROWSER_CALLS,
  CONTRACT_VERSION,
  ErrorCode,
  HelloReply,
  Request,
  type BrowserCall,
  type Hello,
  type Response,
} from "@visthinker/contract";
import type { CallHandler, Transport, TransportStatus } from "@visthinker/core";

/** Close codes the bridge uses to refuse a tab; the canvas stops reconnecting on these. */
export const CLOSE_BUSY = 4409;
export const CLOSE_EXPIRED = 4401;

export interface WsTransportOptions {
  /** `ws://127.0.0.1:<port>/?token=<token>` */
  url: string;
  /** First wait before a reconnect; doubles up to `maxReconnectMs`. */
  reconnectMs?: number;
  maxReconnectMs?: number;
}

export interface WsTransport extends Transport {
  /** Opens the connection. Separate from creating it, so React's dev double-mount opens one socket. */
  start(): void;
  /** After `busy` or `expired`: try once more. Does nothing in any other state. */
  reconnect(): void;
}

/** Reads `?ws=<port>&token=<token>` from the page's address. Null when opened without a bridge. */
export function bridgeUrlFromPage(search: string): string | null {
  const params = new URLSearchParams(search);
  const port = params.get("ws");
  const token = params.get("token");
  if (!port || !/^\d{1,5}$/.test(port) || !token) return null;
  return `ws://127.0.0.1:${port}/?token=${encodeURIComponent(token)}`;
}

/** Turns whatever a handler threw into the wire's error shape. */
function toError(error: unknown): Extract<Response, { ok: false }>["error"] {
  const code = ErrorCode.safeParse((error as { code?: unknown } | null)?.code);
  const message = error instanceof Error ? error.message : String(error);
  return { code: code.success ? code.data : "internal", message: message.slice(0, 1_000) };
}

export function createWsTransport(options: WsTransportOptions): WsTransport {
  const { url } = options;
  const firstWait = options.reconnectMs ?? 500;
  const maxWait = options.maxReconnectMs ?? 5_000;
  let wait = firstWait;
  let status: TransportStatus = "connecting";
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let handler: CallHandler | undefined;
  /** close() was called: never again. */
  let stopped = false;
  /** The bridge refused this tab: wait for reconnect(). */
  let halted = false;
  let started = false;
  const listeners = new Set<(status: TransportStatus) => void>();

  const setStatus = (next: TransportStatus) => {
    if (next === status) return;
    status = next;
    for (const listener of [...listeners]) listener(next);
  };

  const send = (ws: WebSocket, message: Hello | Response) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };

  const answer = async (ws: WebSocket, message: unknown) => {
    const parsed = Request.safeParse(message);
    if (!parsed.success) {
      // Unreadable, but with an id: answer it, so the bridge doesn't wait out its timeout.
      const id = (message as { id?: unknown } | null)?.id;
      if (typeof id === "number" && Number.isInteger(id) && id >= 0) {
        send(ws, {
          id,
          ok: false,
          error: { code: "unknown_call", message: "not a request this canvas understands" },
        });
      }
      return;
    }
    const { id, call, args } = parsed.data;
    if (!(BROWSER_CALLS as string[]).includes(call)) {
      send(ws, {
        id,
        ok: false,
        error: {
          code: "unknown_call",
          message: `${call} is answered by the bridge, not the canvas`,
        },
      });
      return;
    }
    if (!handler) {
      send(ws, {
        id,
        ok: false,
        error: { code: "internal", message: "nothing on the canvas is serving calls" },
      });
      return;
    }
    try {
      send(ws, { id, ok: true, result: await handler(call as BrowserCall, args) });
    } catch (error) {
      send(ws, { id, ok: false, error: toError(error) });
    }
  };

  const open = () => {
    if (stopped || halted) return;
    setStatus("connecting");
    const ws = new WebSocket(url);
    socket = ws;
    let greeted = false;

    ws.onopen = () => send(ws, { hello: { contract: CONTRACT_VERSION } });

    ws.onmessage = (event: MessageEvent) => {
      let message: unknown;
      try {
        message = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
      } catch {
        return;
      }
      if (!greeted) {
        const reply = HelloReply.safeParse(message);
        if (!reply.success) return;
        if (reply.data.hello.ok) {
          greeted = true;
          wait = firstWait;
          setStatus("ready");
        } else {
          halted = true; // a contract mismatch won't fix itself by retrying
          setStatus("expired");
          ws.close();
        }
        return;
      }
      void answer(ws, message);
    };

    ws.onerror = () => {}; // quiet: onclose follows and decides
    ws.onclose = (event: CloseEvent) => {
      if (socket === ws) socket = null;
      if (stopped) return setStatus("closed");
      if (event.code === CLOSE_BUSY || event.code === CLOSE_EXPIRED) {
        halted = true;
        return setStatus(event.code === CLOSE_BUSY ? "busy" : "expired");
      }
      if (halted) return; // refused hello: the status already says why
      setStatus("connecting");
      timer = setTimeout(open, wait);
      wait = Math.min(wait * 2, maxWait);
    };
  };

  return {
    start() {
      if (started || stopped) return;
      started = true;
      open();
    },
    serve(next) {
      handler = next;
      return () => {
        if (handler === next) handler = undefined;
      };
    },
    status: () => status,
    onStatus(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reconnect() {
      if (stopped || !halted) return;
      halted = false;
      wait = firstWait;
      if (timer) clearTimeout(timer);
      open();
    },
    close() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (socket) socket.close();
      else setStatus("closed");
    },
  };
}
