// `pnpm teach:letters <project id> <text>`: teaches the handwriting ability the letters written on
// a saved canvas (D174), until "it's A" is on the canvas itself. The letters are read left to right
// and named by <text> in order ("HELLO", or "HELLO HELLO" for two words; spaces are skipped), then
// added to ~/.visthinker/abilities/handwriting/examples.json, keeping the last 10 per letter.
// A dev tool only. Close the canvas first: an open canvas saves its own copy over this one.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { HandwritingExamples, Project } from "../../packages/contract/src/index.ts";
import { exampleFrom, keepNewest } from "../../packages/core/src/index.ts";
import { lettersOf } from "../try-letters/letters.ts";

const [id, ...words] = process.argv.slice(2);
const home = process.env.VISTHINKER_HOME || join(homedir(), ".visthinker");
const file = join(home, "abilities", "handwriting", "examples.json");

async function main() {
  const text = words.join("").replace(/\s+/g, "");
  if (!id || !text) throw new Error("Usage: pnpm teach:letters <project id> <text, e.g. HELLO>");
  const raw = JSON.parse(await readFile(join(home, "projects", id, "project.json"), "utf8"));
  const project = Project.parse(raw);
  const letters = lettersOf(project.snapshot);
  if (letters.length !== text.length)
    throw new Error(
      `The canvas has ${letters.length} letters but "${text}" has ${text.length}. ` +
        "Run pnpm try:letters to see how it splits them.",
    );
  const saved = await readFile(file, "utf8").then(
    (t) => HandwritingExamples.parse(JSON.parse(t)).examples,
    () => [],
  );
  const at = new Date().toISOString();
  const stamp = Date.now().toString(36);
  const taught = letters.map((l, i) =>
    exampleFrom(l.strokes, { id: `${stamp}-${i}`, label: text[i]!, from: "you", at }),
  );
  const examples = keepNewest([...saved, ...taught]);
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.tmp-${stamp}`;
  await writeFile(temp, `${JSON.stringify({ version: 1, examples })}\n`);
  await rename(temp, file);
  const counts = new Map<string, number>();
  for (const e of examples) counts.set(e.label, (counts.get(e.label) ?? 0) + 1);
  console.log(`Taught ${text} from ${project.meta.name} (${id}).`);
  console.log(`${file} now has ${[...counts].map(([l, n]) => `${l} ${n}`).join(" · ")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
