// Ports (D83): what the core needs from the outside, as small interfaces.
// Adapters in the app implement them; each has an in-memory fake for tests.
export * from "./clock.ts";
export * from "./renderer.ts";
export * from "./transport.ts";
export * from "./packs.ts";
