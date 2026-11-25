// `pnpm try:letters [project id or project.json] [--json]`: what the handwriting ability's first
// step (T51) measures in the letters on a saved canvas. Reads the newest project in
// ~/.visthinker/projects (or VISTHINKER_HOME) unless one is named. Reads only; changes nothing.
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Project } from "../../packages/contract/src/index.ts";
import { LEGEND, describe, lettersOf } from "./letters.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const named = args.find((a) => !a.startsWith("--"));
const projects = join(process.env.VISTHINKER_HOME || join(homedir(), ".visthinker"), "projects");

async function newestProject(): Promise<string> {
  const ids = await readdir(projects).catch(() => [] as string[]);
  const found = await Promise.all(
    ids.map(async (id) => {
      const file = join(projects, id, "project.json");
      const info = await stat(file).catch(() => undefined);
      return info ? { file, time: info.mtimeMs } : undefined;
    }),
  );
  const newest = found.filter((f) => f !== undefined).sort((a, b) => b.time - a.time)[0];
  if (!newest)
    throw new Error(`No saved projects in ${projects}. Open the canvas from Claude Code first.`);
  return newest.file;
}

async function main() {
  const file = named?.endsWith(".json")
    ? named
    : named
      ? join(projects, named, "project.json")
      : await newestProject();
  const parsed = Project.safeParse(JSON.parse(await readFile(file, "utf8")));
  if (!parsed.success) throw new Error(`${file} is not a saved project: ${parsed.error.message}`);
  const { meta, snapshot } = parsed.data;
  const readings = lettersOf(snapshot);

  if (json) {
    const out = readings.map((r) => ({
      strokeIds: r.strokes.map((s) => s.id),
      ...r.features,
    }));
    console.log(JSON.stringify({ project: meta.id, name: meta.name, letters: out }, null, 2));
    return;
  }
  const when = new Date(meta.updatedAt).toLocaleString();
  console.log(`${meta.name} (${meta.id}), saved ${when}`);
  if (readings.length === 0) {
    console.log("\nNothing written on this canvas yet (or all of it was erased or undone).");
    console.log("Write some letters, wait a second for the canvas to save, then run this again.");
    return;
  }
  const count = `${readings.length} letter${readings.length === 1 ? "" : "s"}`;
  console.log(`${count}, left to right\n\n${LEGEND}\n`);
  console.log(readings.map((r, i) => describe(r, i + 1)).join("\n\n"));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
