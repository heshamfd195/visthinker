// Your handwriting examples on disk (D174): `<home>/abilities/handwriting/examples.json`, a folder
// for the ability, not a pack, so `write_pack` never touches it. The canvas reads it on start and
// saves the whole list after each change; it is checked against the contract both ways and written
// to a temp file first.
import { ContractError, HandwritingExamples } from "@visthinker/contract";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { log } from "../log.ts";
import { readJson, writeJson } from "../projects/store.ts";

export class ExampleStore {
  readonly file: string;

  constructor(home: string) {
    this.file = join(home, "abilities", "handwriting", "examples.json");
  }

  /** The saved examples; none yet, or a file that isn't valid, is an empty list. */
  async read(): Promise<HandwritingExamples> {
    const raw = await readJson(this.file).catch(() => undefined);
    const parsed = HandwritingExamples.safeParse(raw);
    if (raw !== undefined && !parsed.success) log(`ignored ${this.file}: not valid examples`);
    return parsed.success ? parsed.data : { version: 1, examples: [] };
  }

  async save(raw: unknown): Promise<HandwritingExamples> {
    const parsed = HandwritingExamples.safeParse(raw);
    if (!parsed.success) throw new ContractError("bad_args", "not valid handwriting examples");
    await mkdir(dirname(this.file), { recursive: true });
    await writeJson(this.file, parsed.data);
    return parsed.data;
  }
}
