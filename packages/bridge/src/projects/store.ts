// Projects on disk (D142): `<home>/projects/<id>/project.json`, one folder per project, holding
// its canvas (story, ink, scene, undo history) and its chats. Behaviour settings sit next to them
// in `<home>/settings.json` (D143). Everything is checked against the contract on the way in and
// out, and written to a temp file first, so a crash never leaves half a project.
import { BehaviourSettings, ContractError, Project, ProjectMeta } from "@visthinker/contract";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../log.ts";

export async function readJson(path: string): Promise<unknown | undefined> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ContractError("bad_contract", `${path} isn't valid JSON`);
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  const temp = `${path}.tmp-${randomBytes(4).toString("hex")}`;
  await writeFile(temp, `${JSON.stringify(value)}\n`);
  await rename(temp, path);
}

export class ProjectStore {
  readonly dir: string;
  readonly settingsFile: string;

  constructor(home: string) {
    this.dir = join(home, "projects");
    this.settingsFile = join(home, "settings.json");
  }

  /** The folder for an id. The id rule (lowercase, digits, dashes) keeps it inside `dir`. */
  #folderOf(id: string): string {
    const parsed = ProjectMeta.shape.id.safeParse(id);
    if (!parsed.success) throw new ContractError("bad_args", `"${id}" is not a project id`);
    return join(this.dir, parsed.data);
  }

  /** Every project's meta, the most recently used first. Broken ones are skipped. */
  async list(): Promise<ProjectMeta[]> {
    let entries: string[];
    try {
      entries = await readdir(this.dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const metas: ProjectMeta[] = [];
    for (const entry of entries) {
      try {
        const raw = await readJson(join(this.dir, entry, "project.json"));
        const parsed = Project.shape.meta.safeParse((raw as { meta?: unknown } | undefined)?.meta);
        if (parsed.success) metas.push(parsed.data);
      } catch {
        log(`skipped project ${entry}: it can't be read`);
      }
    }
    return metas.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async read(id: string): Promise<Project> {
    const raw = await readJson(join(this.#folderOf(id), "project.json"));
    if (raw === undefined) throw new ContractError("unknown_target", `no project ${id}`);
    const parsed = Project.safeParse(raw);
    if (!parsed.success) {
      throw new ContractError("bad_contract", `project ${id} on disk isn't valid`);
    }
    return parsed.data;
  }

  async save(raw: unknown): Promise<ProjectMeta> {
    const parsed = Project.safeParse(raw);
    if (!parsed.success) {
      throw new ContractError("bad_args", `not a project: ${parsed.error.message.slice(0, 600)}`);
    }
    const folder = this.#folderOf(parsed.data.meta.id);
    await mkdir(folder, { recursive: true });
    await writeJson(join(folder, "project.json"), parsed.data);
    return parsed.data.meta;
  }

  async readSettings(): Promise<BehaviourSettings> {
    const raw = await readJson(this.settingsFile).catch(() => undefined);
    const parsed = BehaviourSettings.safeParse(raw ?? {});
    return parsed.success ? parsed.data : BehaviourSettings.parse({});
  }

  async saveSettings(raw: unknown): Promise<BehaviourSettings> {
    const parsed = BehaviourSettings.safeParse(raw);
    if (!parsed.success) throw new ContractError("bad_args", "not valid settings");
    await mkdir(join(this.settingsFile, ".."), { recursive: true });
    await writeJson(this.settingsFile, parsed.data);
    return parsed.data;
  }
}
