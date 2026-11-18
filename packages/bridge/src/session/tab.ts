import {
  checkHello,
  ContractError,
  Response as BridgeResponse,
  type BrowserCall,
  type Request as BridgeRequest,
} from "@visthinker/contract";
import type { RawData, WebSocket } from "ws";
import { log } from "../log.ts";

interface Pending {
  call: BrowserCall;
  resolve: (result: unknown) => void;
  reject: (error: ContractError) => void;
  timer: NodeJS.Timeout;
}

const HELLO_TIMEOUT_MS = 5_000;

/**
 * The one canvas tab of a session (D82) and the relay to it (D90):
 * `{ id, call, args }` out, the matching `{ id, ok, … }` back. It keeps no story or scene.
 */
export class Tab {
  #ws: WebSocket;
  #ready = false;
  #nextId = 1;
  #pending = new Map<number, Pending>();
  #helloTimer: NodeJS.Timeout;

  constructor(ws: WebSocket, onClose: () => void) {
    this.#ws = ws;
    this.#helloTimer = setTimeout(() => {
      log("tab sent no hello in time; closing it");
      ws.close(1008, "no hello");
    }, HELLO_TIMEOUT_MS);
    ws.on("message", (data) => this.#onMessage(data));
    ws.on("error", (error) => log("tab socket error:", String(error)));
    ws.on("close", () => {
      clearTimeout(this.#helloTimer);
      this.#ready = false;
      for (const [id, pending] of this.#pending) {
        clearTimeout(pending.timer);
        pending.reject(
          new ContractError(
            "no_canvas",
            `the canvas tab closed before it answered ${pending.call}`,
          ),
        );
        this.#pending.delete(id);
      }
      onClose();
    });
  }

  /** True once the handshake passed. */
  get ready(): boolean {
    return this.#ready;
  }

  call(call: BrowserCall, args: unknown, timeoutMs: number): Promise<unknown> {
    if (!this.#ready)
      return Promise.reject(
        new ContractError("no_canvas", "the canvas tab has not finished its handshake yet"),
      );
    const id = this.#nextId++;
    const request: BridgeRequest = { id, call, args };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(
          new ContractError("timeout", `the canvas did not answer ${call} within ${timeoutMs} ms`),
        );
      }, timeoutMs);
      this.#pending.set(id, { call, resolve, reject, timer });
      this.#ws.send(JSON.stringify(request), (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(
          new ContractError("no_canvas", `could not send ${call} to the canvas: ${error.message}`),
        );
      });
    });
  }

  close(): void {
    this.#ws.close(1001, "bridge closing");
  }

  #onMessage(data: RawData): void {
    let message: unknown;
    try {
      message = JSON.parse(data.toString());
    } catch {
      log("tab sent a message that is not JSON; ignored");
      return;
    }
    if (!this.#ready) {
      clearTimeout(this.#helloTimer);
      const reply = checkHello(message);
      this.#ws.send(JSON.stringify(reply));
      if (reply.hello.ok) {
        this.#ready = true;
        log("canvas tab connected");
      } else {
        log("tab refused:", reply.hello.error.message);
        this.#ws.close(1008, reply.hello.error.code);
      }
      return;
    }
    const parsed = BridgeResponse.safeParse(message);
    if (!parsed.success) {
      log("tab sent a message that is not a response; ignored");
      return;
    }
    const pending = this.#pending.get(parsed.data.id);
    if (!pending) {
      log(`tab answered unknown or late id ${parsed.data.id}; ignored`);
      return;
    }
    clearTimeout(pending.timer);
    this.#pending.delete(parsed.data.id);
    if (parsed.data.ok) pending.resolve(parsed.data.result);
    else pending.reject(new ContractError(parsed.data.error.code, parsed.data.error.message));
  }
}
