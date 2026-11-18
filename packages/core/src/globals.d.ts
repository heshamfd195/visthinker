// The only host globals the core uses. Both browsers and Node 17+ have them, so the core
// can stay free of the DOM and Node type packages (pure TypeScript, D83).
declare function structuredClone<T>(value: T): T;
