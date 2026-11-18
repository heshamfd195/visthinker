// Builds the publishable package: one bundled file for the bridge (its dependencies inside, so the
// install needs nothing else), the built canvas, and the starter packs, copied in beside it.
import { build } from "esbuild";
import { cp, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const canvasDist = here("../../apps/canvas/dist/");

try {
  await stat(here("../../apps/canvas/dist/index.html"));
} catch {
  throw new Error("build the canvas first: pnpm --filter @visthinker/canvas build");
}

await rm(here("dist"), { recursive: true, force: true });
await build({
  entryPoints: [here("src/cli.ts")],
  outfile: here("dist/visthinker.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // ws loads optional native helpers with require(); give the ESM bundle a require to call.
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire as __visthinkerRequire } from "node:module";',
      "const require = __visthinkerRequire(import.meta.url);",
    ].join("\n"),
  },
  legalComments: "linked",
  logLevel: "warning",
});

for (const [from, to] of [
  [canvasDist, here("canvas/")],
  [here("../../packs/"), here("packs/")],
  [here("../../LICENSE"), here("LICENSE")],
] as const) {
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
}
process.stdout.write("built packages/visthinker: dist/visthinker.js, canvas/, packs/\n");
