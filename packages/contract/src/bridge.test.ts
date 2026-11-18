import { describe, expect, it } from "vitest";
import { ContractError, Request, Response, checkHello } from "./index.ts";

describe("bridge messages (D90)", () => {
  it("the handshake accepts this contract version and refuses others", () => {
    expect(checkHello({ hello: { contract: "0" } })).toEqual({ hello: { ok: true } });
    const wrong = checkHello({ hello: { contract: "1" } });
    expect("error" in wrong.hello && wrong.hello.error.code).toBe("bad_contract");
    expect("error" in checkHello({ hi: 1 }).hello).toBe(true);
  });

  it("a request names a contract tool; nothing else gets through", () => {
    expect(Request.safeParse({ id: 7, call: "get_scene", args: {} }).success).toBe(true);
    expect(Request.safeParse({ id: 7, call: "draw_pixels", args: {} }).success).toBe(false);
  });

  it("a response is a result or an error with a known code", () => {
    expect(Response.safeParse({ id: 7, ok: true, result: {} }).success).toBe(true);
    const error = { id: 7, ok: false, error: { code: "no_canvas", message: "no tab" } };
    expect(Response.safeParse(error).success).toBe(true);
    const unknown = { id: 7, ok: false, error: { code: "oops", message: "" } };
    expect(Response.safeParse(unknown).success).toBe(false);
  });

  it("a ContractError carries its code", () => {
    const error = new ContractError("not_allowed", "not your turn");
    expect([error.code, error.message, error instanceof Error]).toEqual([
      "not_allowed",
      "not your turn",
      true,
    ]);
  });
});
