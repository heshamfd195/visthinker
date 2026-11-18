// The Transport port: how calls from Claude reach the core (D90). Only Claude starts a
// call; the core answers it and never pushes. The WebSocket adapter (T18) implements it.
import type { BrowserCall } from "@visthinker/contract";

/** Answers one call. Throws a ContractError-style error for a bad call. */
export type CallHandler = (call: BrowserCall, args: unknown) => Promise<unknown>;

/**
 * - connecting: opening, or waiting to reconnect
 * - ready: paired with the bridge
 * - busy: another canvas tab holds the session
 * - expired: the link or token is no longer valid
 * - closed: this side closed it
 */
export type TransportStatus = "connecting" | "ready" | "busy" | "expired" | "closed";

export interface Transport {
  /** Starts answering calls with `handler`. Returns a function that stops it. */
  serve(handler: CallHandler): () => void;
  status(): TransportStatus;
  /** Called on each status change. Returns an unsubscribe function. */
  onStatus(listener: (status: TransportStatus) => void): () => void;
  close(): void;
}

/** A transport for tests: `call` plays Claude's side, `setStatus` plays the network. */
export interface MemoryTransport extends Transport {
  call(call: BrowserCall, args: unknown): Promise<unknown>;
  setStatus(status: TransportStatus): void;
}

export function createMemoryTransport(): MemoryTransport {
  let handler: CallHandler | undefined;
  let status: TransportStatus = "ready";
  const listeners = new Set<(status: TransportStatus) => void>();

  const setStatus = (next: TransportStatus) => {
    if (next === status) return;
    status = next;
    for (const listener of [...listeners]) listener(next);
  };

  return {
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
    close: () => setStatus("closed"),
    async call(call, args) {
      if (status !== "ready") throw new Error(`transport is ${status}`);
      if (!handler) throw new Error("nothing is serving calls");
      return handler(call, structuredClone(args));
    },
    setStatus,
  };
}
