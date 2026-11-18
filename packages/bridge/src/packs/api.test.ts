import { describe, expect, it } from "vitest";
import { createPackApi } from "./api.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the pack API client (T34)", () => {
  it("lists the catalog and reads a pack from the configured URL only", async () => {
    const urls: string[] = [];
    const api = createPackApi("http://127.0.0.1:8787/", async (input) => {
      const url = String(input);
      urls.push(url);
      return url.endsWith("/packs")
        ? json({ packs: [{ name: "chess", version: "0.1.0" }] })
        : json({ pack: { "pack.json": {} } });
    });
    expect(await api.list()).toEqual([{ name: "chess", version: "0.1.0" }]);
    expect(await api.read("chess")).toEqual({ "pack.json": {} });
    expect(urls).toEqual(["http://127.0.0.1:8787/packs", "http://127.0.0.1:8787/packs/chess"]);
  });

  it("a name that isn't a pack name never becomes a request", async () => {
    let called = false;
    const api = createPackApi("http://x", async () => ((called = true), json({})));
    await expect(api.read("../admin")).rejects.toMatchObject({ code: "bad_args" });
    expect(called).toBe(false);
  });

  it("404 is unknown_target; unreachable or a server error is internal, saying where", async () => {
    await expect(
      createPackApi("http://x", async () => json({ error: "no" }, 404)).read("chess"),
    ).rejects.toMatchObject({ code: "unknown_target" });
    await expect(createPackApi("http://x", async () => json({}, 500)).list()).rejects.toMatchObject(
      { code: "internal" },
    );
    const down = createPackApi("http://127.0.0.1:1", async () => {
      throw new TypeError("fetch failed");
    });
    await expect(down.list()).rejects.toMatchObject({
      code: "internal",
      message: expect.stringContaining("127.0.0.1:1"),
    });
  });
});
