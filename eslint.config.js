// One-direction imports (D83), enforced by eslint-plugin-boundaries (D87):
//   contract → nothing of ours · core, bridge → contract
//   canvas: app → adapters, features → shared, and everything → core + contract
//   features meet each other only through their index.ts
import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const el = (type, extra = {}) => ({ to: { element: { type, ...extra } } });

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true, noWarnOnMultipleProjects: true } },
      "boundaries/elements": [
        { type: "contract", pattern: "packages/contract" },
        { type: "core", pattern: "packages/core" },
        { type: "bridge", pattern: "packages/bridge" },
        { type: "canvas-app", pattern: "apps/canvas/src/app" },
        { type: "canvas-adapter", pattern: "apps/canvas/src/adapters/*" },
        { type: "canvas-feature", pattern: "apps/canvas/src/features/*" },
        { type: "canvas-shared", pattern: "apps/canvas/src/shared" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            { from: { element: { type: "contract" } }, allow: el("contract") },
            { from: { element: { type: "core" } }, allow: [el("core"), el("contract")] },
            { from: { element: { type: "bridge" } }, allow: [el("bridge"), el("contract")] },
            {
              from: { element: { type: "canvas-shared" } },
              allow: [el("canvas-shared"), el("core"), el("contract")],
            },
            {
              from: { element: { type: "canvas-feature" } },
              allow: [
                el("canvas-feature", { fileInternalPath: "index.ts" }),
                el("canvas-shared"),
                el("core"),
                el("contract"),
              ],
            },
            {
              from: { element: { type: "canvas-adapter" } },
              allow: [el("canvas-shared"), el("core"), el("contract")],
            },
            {
              from: { element: { type: "canvas-app" } },
              allow: [
                el("canvas-app"),
                el("canvas-adapter"),
                el("canvas-feature", { fileInternalPath: "index.ts" }),
                el("canvas-shared"),
                el("core"),
                el("contract"),
              ],
            },
          ],
        },
      ],
    },
  },
  prettier,
);
