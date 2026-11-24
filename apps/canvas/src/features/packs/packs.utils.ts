// Pure helpers for the packs panel (D122): installed vs catalog, search, order, icon and tag.

/** One pack as the panel shows it. */
export type PackRow = {
  name: string;
  version: string;
  source: "starter" | "local" | "api";
  installed: boolean;
  enabled: boolean;
  /** A copy changed locally (D62). */
  yours: boolean;
  note?: string;
};

export type PackIcon = "pen" | "shapes" | "modes" | "package";

/** A pack that switches modes rather than reading a drawing. */
export function isMode(name: string): boolean {
  return name === "modes" || /(^|-)modes?$/.test(name);
}

/** Packs whose name or note holds the search. */
export function filterPacks(rows: readonly PackRow[], search: string): PackRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter(
    (r) => r.name.toLowerCase().includes(q) || (r.note ?? "").toLowerCase().includes(q),
  );
}

/** Installed packs by name with modes last; the catalog by name. */
export function splitPacks(rows: readonly PackRow[]): { installed: PackRow[]; catalog: PackRow[] } {
  const byName = (a: PackRow, b: PackRow) => a.name.localeCompare(b.name);
  const installed = rows
    .filter((r) => r.installed)
    .sort((a, b) => Number(isMode(a.name)) - Number(isMode(b.name)) || byName(a, b));
  const catalog = rows.filter((r) => !r.installed).sort(byName);
  return { installed, catalog };
}

/** Which picture a pack gets. */
export function packIcon(name: string): PackIcon {
  if (isMode(name)) return "modes";
  if (name.includes("shape")) return "shapes";
  if (/hand|draw|sketch|ink/.test(name)) return "pen";
  return "package";
}

/** The small tag beside a pack's name: "your copy" wins over where it came from (D62). */
export function packTag(row: PackRow): string {
  if (row.yours) return "your copy";
  return row.source === "api" ? "catalog" : row.source;
}
