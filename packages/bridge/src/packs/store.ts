// Packs on disk (D93): the user's own in `<home>/packs`, one folder per pack, and the starter packs
// the app ships with (D74), read-only. A local pack of the same name is the one read.
import { ContractError, Pack, PackManifest } from "@visthinker/contract";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../log.ts";

/** `~/.visthinker`, or `VISTHINKER_HOME` (tests use a temp dir). */
export function visthinkerHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.VISTHINKER_HOME || join(homedir(), ".visthinker");
}

/** The repo's packs/ folder, next to this package. */
export const STARTER_DIR = fileURLToPath(new URL("../../../../packs/", import.meta.url));

export type PackSourceName = "starter" | "local";
export interface PackEntry {
  name: string;
  version: string;
  source: PackSourceName;
}

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export class PackStore {
  readonly dir: string;
  readonly starterDir: string;

  constructor(home: string, starterDir: string = STARTER_DIR) {
    this.dir = join(home, "packs");
    this.starterDir = starterDir;
  }

  /** The folder for a pack name. The name rule (lowercase, digits, dashes) keeps it inside `dir`. */
  folderOf(name: string, root = this.dir): string {
    const parsed = PackManifest.shape.name.safeParse(name);
    if (!parsed.success) {
      throw new ContractError(
        "bad_args",
        `"${name}" is not a pack name: lowercase letters, digits and dashes`,
      );
    }
    return join(root, parsed.data);
  }

  /** Writes the pack's files to a temp folder, then swaps it in, replacing an older pack of the name. */
  async save(pack: Pack): Promise<string> {
    const folder = this.folderOf(pack["pack.json"].name);
    const temp = `${folder}.tmp-${randomBytes(4).toString("hex")}`;
    await mkdir(temp, { recursive: true });
    await writeFile(join(temp, "pack.json"), `${JSON.stringify(pack["pack.json"], null, 2)}\n`);
    if (pack["rules.json"])
      await writeFile(join(temp, "rules.json"), `${JSON.stringify(pack["rules.json"], null, 2)}\n`);
    if (pack["README.md"] !== undefined)
      await writeFile(join(temp, "README.md"), pack["README.md"]);
    await rm(folder, { recursive: true, force: true });
    await rename(temp, folder);
    log(`saved pack ${pack["pack.json"].name} to ${folder}`);
    return folder;
  }

  /** A local pack, else a starter pack, checked against the contract. */
  async read(name: string): Promise<Pack> {
    return (
      (await this.#readFrom(this.folderOf(name), name)) ??
      (await this.#readFrom(this.folderOf(name, this.starterDir), name)) ??
      (() => {
        throw new ContractError("unknown_target", `no pack named ${name}`);
      })()
    );
  }

  /** Every pack, starter ones first, each with where it came from. */
  async list(): Promise<PackEntry[]> {
    return [
      ...(await this.#listFrom(this.starterDir, "starter")),
      ...(await this.#listFrom(this.dir, "local")),
    ];
  }

  async #readFrom(folder: string, name: string): Promise<Pack | undefined> {
    const [manifest, rules, readme] = await Promise.all(
      ["pack.json", "rules.json", "README.md"].map((file) => readText(join(folder, file))),
    );
    if (manifest === undefined) return undefined;
    let raw: Record<string, unknown>;
    try {
      raw = { "pack.json": JSON.parse(manifest) };
      if (rules !== undefined) raw["rules.json"] = JSON.parse(rules);
      if (readme !== undefined) raw["README.md"] = readme;
    } catch (error) {
      throw new ContractError(
        "bad_contract",
        `pack ${name} has a file that isn't valid JSON: ${String(error)}`,
      );
    }
    const parsed = Pack.safeParse(raw);
    if (!parsed.success) {
      throw new ContractError(
        "bad_contract",
        `pack ${name} on disk isn't valid: ${parsed.error.message.slice(0, 800)}`,
      );
    }
    return parsed.data;
  }

  async #listFrom(root: string, source: PackSourceName): Promise<PackEntry[]> {
    let entries: string[];
    try {
      entries = await readdir(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const packs: PackEntry[] = [];
    for (const entry of entries.sort()) {
      if (entry.includes(".tmp-")) continue;
      const text = await readText(join(root, entry, "pack.json"));
      if (text === undefined) continue;
      try {
        const manifest = PackManifest.parse(JSON.parse(text));
        packs.push({ name: manifest.name, version: manifest.version, source });
      } catch {
        log(`skipped ${entry}: its pack.json isn't valid`);
      }
    }
    return packs;
  }
}
