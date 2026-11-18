import { z } from "zod";
import { CONTRACT_VERSION } from "./common.ts";
import { TOOL_NAMES, type ToolName } from "./tools.ts";

/** A normal call times out after 10 s; `wait_for_event` uses its own `timeoutMs` (D90). */
export const CALL_TIMEOUT_MS = 10_000;
/** Extra time the bridge gives `wait_for_event` on top of its `timeoutMs`. */
export const WAIT_GRACE_MS = 2_000;

export const ErrorCode = z.enum([
  "no_canvas",
  "timeout",
  "bad_args",
  "bad_contract",
  "unknown_call",
  "unknown_target",
  "not_allowed",
  "internal",
]);
export const ContractErrorShape = z.object({ code: ErrorCode, message: z.string().max(1_000) });

/** The first message from the tab, after it connects with the token (D82 · D90). */
export const Hello = z.object({ hello: z.object({ contract: z.string() }) });
export const HelloReply = z.union([
  z.object({ hello: z.object({ ok: z.literal(true) }) }),
  z.object({ hello: z.object({ ok: z.literal(false), error: ContractErrorShape }) }),
]);

/** Bridge → browser. `args` are checked by the receiver with TOOLS[call].args. */
export const Request = z.object({
  id: z.number().int().nonnegative(),
  call: z.enum(TOOL_NAMES as [ToolName, ...ToolName[]]),
  args: z.unknown(),
});

/** Browser → bridge. Only ever an answer: the browser never starts a call (D90). */
export const Response = z.union([
  z.object({ id: z.number().int().nonnegative(), ok: z.literal(true), result: z.unknown() }),
  z.object({ id: z.number().int().nonnegative(), ok: z.literal(false), error: ContractErrorShape }),
]);

export type ErrorCode = z.infer<typeof ErrorCode>;
export type Hello = z.infer<typeof Hello>;
export type HelloReply = z.infer<typeof HelloReply>;
export type Request = z.infer<typeof Request>;
export type Response = z.infer<typeof Response>;

/** Thrown by the Fast Brain or the bridge; becomes `{ ok: false, error }` on the wire. */
export class ContractError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ContractError";
    this.code = code;
  }
}

/** The handshake check: the tab's contract version must match (D90). */
export function checkHello(message: unknown): HelloReply {
  const parsed = Hello.safeParse(message);
  if (!parsed.success) {
    return {
      hello: {
        ok: false,
        error: { code: "bad_contract", message: "expected { hello: { contract } }" },
      },
    };
  }
  if (parsed.data.hello.contract !== CONTRACT_VERSION) {
    return {
      hello: {
        ok: false,
        error: {
          code: "bad_contract",
          message: `contract ${parsed.data.hello.contract} does not match ${CONTRACT_VERSION}`,
        },
      },
    };
  }
  return { hello: { ok: true } };
}
