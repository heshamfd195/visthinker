// stdout belongs to MCP; everything else goes to stderr.
export function log(...parts: unknown[]): void {
  const text = parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ");
  process.stderr.write(`[visthinker-bridge] ${text}\n`);
}
