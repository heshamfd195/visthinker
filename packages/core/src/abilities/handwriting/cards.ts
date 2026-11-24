// The character cards (D112 · T52): block capitals by their structure. A, H, E, L and O first, for
// "hello" and the A in the drawing; the rest of A–Z and 0–9 follow. Weights are a first draft to
// tune on real writing. Places are shares of the letter's box from its top left, y growing down.
import type { CharacterCard, PartSelector } from "@visthinker/contract";

const LONG = 0.6;
const leg = (slant: PartSelector["slant"]): PartSelector => ({ slant, minLength: LONG });
const upright: PartSelector = leg("upright");
const bar: PartSelector = { slant: "flat", minLength: 0.2 };
const anyPart: PartSelector = {};

/** A: two legs leaning together, meeting at the top, and a bar across them (the drawing's card). */
const A: CharacterCard = {
  char: "A",
  checks: [
    {
      label: "2 or 3 strokes (an ∧ and a bar counts)",
      weight: 10,
      tests: [{ test: "strokes", min: 2, max: 3 }],
    },
    {
      label: "two long legs, slanting opposite ways",
      weight: 25,
      tests: [
        { test: "count", parts: leg("right"), min: 1 },
        { test: "count", parts: leg("left"), min: 1 },
      ],
    },
    {
      label: "the legs meet at the top",
      weight: 25,
      tests: [
        {
          test: "join",
          a: leg("right"),
          b: leg("left"),
          how: "any",
          at: { y: [-0.2, 0.3] },
          min: 1,
        },
      ],
    },
    {
      label: "a short bar crosses both legs",
      weight: 25,
      tests: [
        {
          test: "join",
          a: { slant: "flat", maxLength: 0.8 },
          b: { minLength: LONG },
          how: "any",
          min: 2,
        },
      ],
    },
    {
      label: "the bar sits in the middle band",
      weight: 15,
      tests: [
        {
          test: "join",
          a: { slant: "flat", maxLength: 0.8 },
          b: { minLength: LONG },
          how: "any",
          at: { y: [0.35, 0.75] },
          min: 1,
        },
      ],
    },
  ],
};

/** H: two upright legs that stay apart, and a bar between them halfway down. */
const H: CharacterCard = {
  char: "H",
  checks: [
    { label: "1 to 3 strokes", weight: 10, tests: [{ test: "strokes", min: 1, max: 3 }] },
    {
      label: "two upright legs",
      weight: 20,
      tests: [{ test: "count", parts: upright, min: 2, max: 2 }],
    },
    { label: "one bar across", weight: 15, tests: [{ test: "count", parts: bar, min: 1, max: 1 }] },
    {
      label: "the bar reaches both legs",
      weight: 25,
      tests: [{ test: "join", a: bar, b: upright, how: "any", min: 2 }],
    },
    {
      label: "the bar sits in the middle band",
      weight: 15,
      tests: [{ test: "join", a: bar, b: upright, how: "any", at: { y: [0.25, 0.75] }, min: 1 }],
    },
    {
      label: "the legs stay apart",
      weight: 15,
      tests: [{ test: "join", a: upright, b: upright, how: "any", min: 0, max: 0 }],
    },
  ],
};

/** E: an upright back with three bars off it, open on the right. */
const E: CharacterCard = {
  char: "E",
  checks: [
    { label: "1 to 4 strokes", weight: 10, tests: [{ test: "strokes", min: 1, max: 4 }] },
    {
      label: "one upright back",
      weight: 20,
      tests: [{ test: "count", parts: upright, min: 1, max: 1 }],
    },
    { label: "three bars", weight: 25, tests: [{ test: "count", parts: bar, min: 3, max: 3 }] },
    {
      label: "the bars start at the back",
      weight: 30,
      tests: [{ test: "join", a: bar, b: upright, how: "any", at: { x: [-0.2, 0.35] }, min: 3 }],
    },
    {
      label: "open on the right",
      weight: 15,
      tests: [
        { test: "count", parts: { slant: "upright", at: { x: [0.6, 1.2] } }, min: 0, max: 0 },
      ],
    },
  ],
};

/** L: an upright that turns into a foot along the bottom, nothing higher up. */
const L: CharacterCard = {
  char: "L",
  checks: [
    { label: "1 or 2 strokes", weight: 10, tests: [{ test: "strokes", min: 1, max: 2 }] },
    {
      label: "one upright",
      weight: 25,
      tests: [{ test: "count", parts: upright, min: 1, max: 1 }],
    },
    {
      label: "a foot along the bottom",
      weight: 25,
      tests: [
        {
          test: "count",
          parts: { slant: "flat", minLength: 0.25, at: { y: [0.6, 1.2] } },
          min: 1,
          max: 1,
        },
      ],
    },
    {
      label: "the upright turns into the foot at the bottom left",
      weight: 25,
      tests: [
        {
          test: "join",
          a: upright,
          b: anyPart,
          how: "any",
          at: { x: [-0.2, 0.5], y: [0.5, 1.2] },
          min: 1,
        },
      ],
    },
    {
      label: "no bars higher up",
      weight: 15,
      tests: [{ test: "count", parts: { slant: "flat", at: { y: [-0.2, 0.6] } }, min: 0, max: 0 }],
    },
  ],
};

/** O: one round closed loop that is the whole letter. */
const O: CharacterCard = {
  char: "O",
  checks: [
    { label: "1 or 2 strokes", weight: 10, tests: [{ test: "strokes", min: 1, max: 2 }] },
    { label: "a closed loop", weight: 40, tests: [{ test: "loops", min: 1, max: 1 }] },
    {
      label: "the loop is the whole letter",
      weight: 20,
      tests: [{ test: "loops", min: 1, minSize: 0.7 }],
    },
    {
      label: "round: no long straight lines",
      weight: 15,
      tests: [{ test: "count", parts: { kind: "line", minLength: 0.4 }, min: 0, max: 0 }],
    },
    {
      label: "drawn in curves",
      weight: 15,
      tests: [{ test: "count", parts: { kind: "curve", minLength: 0.5 }, min: 1 }],
    },
  ],
};

/** The cards the ability reads with, today. */
export const CARDS: readonly CharacterCard[] = [A, H, E, L, O];
