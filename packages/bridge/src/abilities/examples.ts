// Your handwriting examples, kept in the repo with the ability (D178):
// `packages/core/src/abilities/handwriting/data/examples.json`, so each letter you teach is a
// change in git and goes out with the ability; nothing lives elsewhere on disk. The canvas reads
// them on start and saves the whole list after each change, checked against the contract both
// ways and written to a temp file first, one example per line so git shows each new one.
import { ContractError, HandwritingExamples } from "@visthinker/contract";
import { randomBytes } from "node:crypto";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { log } from "../log.ts";
import { readJson } from "../projects/store.ts";

/** Where an ability keeps its data, inside its own folder under `abilitiesDir` (D178). */
export const examplesFile = (abilitiesDir: string) =>
  join(abilitiesDir, "handwriting", "data", "examples.json");

export class ExampleStore {
  readonly file: string;
  /** The ability's folder: it must exist, as it does in a checkout of the repo. */
  readonly ability: string;

  constructor(abilitiesDir: string) {
    this.file = examplesFile(abilitiesDir);
    this.ability = join(abilitiesDir, "handwriting");
  }

  /** The saved examples; none yet, no repo, or a file that isn't valid, is an empty list. */
  async read(): Promise<HandwritingExamples> {
    const raw = await readJson(this.file).catch(() => undefined);
    const parsed = HandwritingExamples.safeParse(raw);
    if (raw !== undefined && !parsed.success) log(`ignored ${this.file}: not valid examples`);
    return parsed.success ? parsed.data : { version: 1, examples: [] };
  }

  async save(raw: unknown): Promise<HandwritingExamples> {
    const parsed = HandwritingExamples.safeParse(raw);
    if (!parsed.success) throw new ContractError("bad_args", "not valid handwriting examples");
    // An npm install has no repo to write into (D178): nothing is saved anywhere else.
    if (!(await stat(this.ability).catch(() => undefined))?.isDirectory())
      throw new ContractError(
        "not_allowed",
        `no handwriting ability folder at ${this.ability}: examples are saved only in a checkout of the repo (D178)`,
      );
    await mkdir(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp-${randomBytes(4).toString("hex")}`;
    await writeFile(temp, linePerExample(parsed.data));
    await rename(temp, this.file);
    return parsed.data;
  }
}

/** The examples file with one example per line, so each one you teach is one line in git. */
export function linePerExample({ version, examples }: HandwritingExamples): string {
  const lines = examples.map((e) => `    ${JSON.stringify(e)}`).join(",\n");
  return `{\n  "version": ${version},\n  "examples": [\n${lines}${lines ? "\n" : ""}  ]\n}\n`;
}
