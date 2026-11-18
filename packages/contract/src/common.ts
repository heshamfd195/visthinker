import { z } from "zod";

/** The contract version the bridge and the canvas agree on in the handshake (D90). */
export const CONTRACT_VERSION = "0" as const;

/** A stable object id, never pixels (D79). */
export const Id = z.string().min(1).max(64);

/** World units on the canvas, x then y (D88). */
export const Point2 = z.tuple([z.number(), z.number()]);

/** x, y, width, height in world units (D79). */
export const Box = z.tuple([
  z.number(),
  z.number(),
  z.number().nonnegative(),
  z.number().nonnegative(),
]);

export type Id = z.infer<typeof Id>;
export type Point2 = z.infer<typeof Point2>;
export type Box = z.infer<typeof Box>;
