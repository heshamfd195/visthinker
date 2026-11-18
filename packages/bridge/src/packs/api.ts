// The Visthinker API's pack catalog (T34): what the bridge can install beyond its own packs.
// Only the URL set in VISTHINKER_API is ever called, and a pack name is checked before it goes
// into a URL. Failures become ContractErrors Claude can read.
import { ContractError, PackManifest } from "@visthinker/contract";

export interface ApiPack {
  name: string;
  version: string;
  description?: string;
}

export interface PackApi {
  readonly url: string;
  list(): Promise<ApiPack[]>;
  /** A pack's files, unchecked: the caller checks them against the contract. */
  read(name: string): Promise<unknown>;
}

/** How long one request may take. */
export const API_TIMEOUT_MS = 5_000;

export function createPackApi(url: string, fetcher: typeof fetch = fetch): PackApi {
  const base = url.replace(/\/+$/, "");

  const get = async (path: string): Promise<unknown> => {
    let res: Response;
    try {
      res = await fetcher(`${base}${path}`, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    } catch (error) {
      throw new ContractError(
        "internal",
        `the Visthinker API at ${base} isn't reachable: ${String(error)}`,
      );
    }
    if (res.status === 404)
      throw new ContractError("unknown_target", `the Visthinker API has no ${path}`);
    if (!res.ok)
      throw new ContractError("internal", `the Visthinker API answered ${res.status} for ${path}`);
    return res.json();
  };

  return {
    url: base,
    async list() {
      const body = (await get("/packs")) as { packs?: ApiPack[] };
      return Array.isArray(body.packs) ? body.packs : [];
    },
    async read(name) {
      if (!PackManifest.shape.name.safeParse(name).success) {
        throw new ContractError(
          "bad_args",
          `"${name}" is not a pack name: lowercase letters, digits and dashes`,
        );
      }
      const body = (await get(`/packs/${encodeURIComponent(name)}`)) as { pack?: unknown };
      return body.pack;
    },
  };
}
