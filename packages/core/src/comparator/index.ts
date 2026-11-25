// The comparator (D64): turns strokes into objects of the built-in `shapes` pack (D89).
// A straight stroke of 400+ units is a line at once (D109), and each pair of lines that cross makes
// a crossing. Every other stroke is grouped first (D96): strokes close in place and time form one
// group, read about 0.6 s after the last one. A group is then a one-stroke box,
// circle or arrow, or a symbol read by the cross rule and $P against the packs' templates (D97).
// The handwriting ability splits a group into letters first and reads each by the character
// cards (D112 · D113), or by your own examples first when one is sure (D174): two or more letters,
// or one clear letter, are a written `word` such as
// "HELLO", not a symbol, and each new or changed letter gets a `letter` event (T51–T53).
import type {
  Box,
  CharacterCard,
  LetterEventDetail,
  LetterReading,
  Pack,
  TaughtDetail,
  WordReading,
  Point2,
  SceneObject,
  Stroke,
  VisEvent,
} from "@visthinker/contract";
import { NOT_A_LETTER } from "@visthinker/contract";
import {
  CARDS,
  createExampleMatcher,
  exampleFrom,
  letterFeatures,
  readHandwriting,
  type ExampleBook,
  type ReadLetter,
} from "../abilities/handwriting/index.ts";
import type { Clock } from "../ports/index.ts";
import { strokeBox } from "../scene/strokes.ts";
import type { SceneStore } from "../scene/store.ts";
import type { StrokeStore } from "../scene/strokes.ts";
import type { Story } from "../scene/story.ts";
import { boxAround as boxOf } from "../scene/transform.ts";
import { crossingPoint, fitLine } from "./geometry.ts";
import { classifyShape } from "./shapes.ts";
import { createRecognizer, symbolSetsFrom } from "./symbols.ts";

export * from "./cross.ts";
export * from "./geometry.ts";
export * from "./shapes.ts";
export * from "./symbols.ts";

export const SHAPES_PACK = "shapes";
/** What a written word is read by: the handwriting ability, not a pack (D161). */
export const HANDWRITING = "handwriting";

/** D109: a straight stroke at least this long is a line at once (D97 had 160). */
export const INSTANT_LINE_LENGTH = 400;
/** One-stroke shapes the comparator reads on its own (T27). */
const SHAPES: ReadonlySet<string> = new Set(["box", "circle", "arrow"]);
/** D183: a stroke joining a shape is at most this share of its size (a Q's tail). */
export const SHAPE_TAIL = 0.75;
/** D97: a group is read this long after its last stroke. */
export const GROUP_MS = 600;
/** A stroke joins the open group if it starts within this long of its last stroke… */
export const GROUP_GAP_MS = 700;
/** …and its box is closer to the group's than this share of the larger of the two. */
export const GROUP_NEAR = 0.5;
/**
 * D110: a stroke that lands close by within this long of the last symbol's last stroke rejoins
 * it, and both are read again together (an X's second stroke can come late). With handwriting on,
 * D176 waits longer (WORD_REJOIN_MS).
 */
export const REJOIN_MS = 2_000;
/**
 * D169: a written word waits longer for its next letter: a stroke beside it (closer than half its
 * height) joins it within this long. Writers pause between letters (2.4 s after a real H). D176:
 * with handwriting on, a lone mark waits as long, so a slow H's second leg finds its first.
 */
export const WORD_REJOIN_MS = 5_000;
/**
 * A word's letters get their names once you pause this long or move on to another letter, so a
 * letter you're still writing never flashes a wrong name (an E read as L after three strokes).
 */
export const SETTLE_MS = 1_500;

export interface Comparator {
  /** Takes a recorded stroke: a line at once, or into a group read a moment later. */
  onStroke(stroke: Stroke, strokeEvent: VisEvent): string[];
  /** Reads the open group now instead of after GROUP_MS (e.g. before a call needs the scene). */
  flush(): void;
  /** Ids of the objects made from a stroke, and the crossings on them (for undo). */
  madeFrom(strokeId: string): string[];
}

export interface ComparatorDeps {
  scene: SceneStore;
  story: Story;
  strokes: StrokeStore;
  clock: Clock;
  /** The installed packs, read at each group for their symbol templates. */
  packs: () => readonly Pack[];
  /**
   * The handwriting ability (D161): on by default, it splits each word into letters and adds a
   * `letter` event per letter with what it measured (T51).
   */
  handwriting?: boolean;
  /** The character cards it reads letters with (D112); the built-in ones by default. */
  cards?: readonly CharacterCard[];
  /**
   * Your handwriting examples (D174), matched before the cards. A word or mark Claude labels
   * (you said "it's A" in the chat, D175) is saved into them, one example per letter.
   */
  examples?: ExampleBook;
  /** The time now as an ISO date, for an example's `at`; the core never reads the wall clock. */
  wallClock?: () => string;
}

interface Group {
  /** The symbol this group reads again, when a late stroke rejoined it (D110). */
  symbol?: string;
  /** Other recent symbols this group took in, removed once it is read (an H's legs read apart). */
  absorbed?: string[];
  strokes: string[];
  box: Box;
  lastEnd: number;
  lastSeq: number;
  cancel: () => void;
}

const size = (b: Box) => Math.max(b[2], b[3]);
const union = (a: Box, b: Box): Box =>
  boxOf([
    [a[0], a[1]],
    [a[0] + a[2], a[1] + a[3]],
    [b[0], b[1]],
    [b[0] + b[2], b[1] + b[3]],
  ]);
/** The gap between two boxes (0 when they overlap). */
const gap = (a: Box, b: Box) =>
  Math.hypot(
    Math.max(0, a[0] - (b[0] + b[2]), b[0] - (a[0] + a[2])),
    Math.max(0, a[1] - (b[1] + b[3]), b[1] - (a[1] + a[3])),
  );

export function createComparator({
  scene,
  story,
  strokes,
  clock,
  packs,
  handwriting = true,
  cards = CARDS,
  examples,
  wallClock = () => new Date(clock.now()).toISOString(),
}: ComparatorDeps): Comparator {
  // Your examples name a letter before the cards do (D174).
  const matcher = examples ? createExampleMatcher(examples) : undefined;
  // A word Claude labels is taught: each of its letters becomes an example (D175). After the
  // label is in, not during it: `act` may still be applying the rest of its actions.
  if (examples && handwriting)
    story.subscribe((e) => {
      if (e.type !== "label" || e.detail?.["by"] !== "claude" || !e.target) return;
      const [target, text, cause] = [e.target, String(e.detail["text"] ?? ""), e.seq];
      clock.after(0, () => teach(examples, target, text, cause));
    });
  let group: Group | undefined;
  /** The last symbol read, which a late stroke may still rejoin (D110). */
  let recent: Omit<Group, "cancel">[] = [];
  const isLine = (o: SceneObject) => o.kind === "line" && o.pack === SHAPES_PACK;
  const ends = (o: SceneObject) => o.geom as { a: Point2; b: Point2 };
  const strokeEnd = (s: Stroke) => s.t0 + (s.points.at(-1)?.[3] ?? 0);

  const recognized = (id: string, detail: Record<string, unknown>, cause: number) =>
    story.append({ who: "fastbrain", type: "recognized", target: id, detail, cause });

  const add = (
    object: Omit<SceneObject, "pack" | "parts" | "relations"> & Partial<SceneObject>,
  ) => {
    const full: SceneObject = { pack: SHAPES_PACK, parts: [], relations: [], ...object };
    scene.add(full, "user");
    return full;
  };

  const joins = (g: Group, stroke: Stroke) => {
    const box = strokeBox(stroke);
    return (
      stroke.t0 - g.lastEnd <= GROUP_GAP_MS &&
      gap(g.box, box) < GROUP_NEAR * Math.max(size(g.box), size(box))
    );
  };

  /** D110: a late stroke close by reopens a recent symbol. */
  const rejoins = (last: Omit<Group, "cancel">, stroke: Stroke) => {
    if (!last.symbol || !scene.has(last.symbol)) return false;
    const box = strokeBox(stroke);
    // A shape takes only a smaller stroke that lands on it (a Q's tail), never one beside it: an
    // arrow drawn up to a circle stays an arrow (D183).
    if (SHAPES.has(scene.get(last.symbol)!.kind))
      return (
        stroke.t0 - last.lastEnd <= WORD_REJOIN_MS &&
        gap(last.box, box) === 0 &&
        size(box) <= SHAPE_TAIL * size(last.box)
      );
    // A word waits longer, for a stroke beside it on its line (D169), and so does any mark while
    // handwriting is on: a lone leg no card names yet may be half an H (D176, a 2.4 s pause).
    if (handwriting || scene.get(last.symbol)!.kind === "word")
      return (
        stroke.t0 - last.lastEnd <= WORD_REJOIN_MS &&
        gap(last.box, box) < GROUP_NEAR * Math.max(last.box[3], box[3])
      );
    if (stroke.t0 - last.lastEnd > REJOIN_MS) return false;
    return gap(last.box, box) < GROUP_NEAR * Math.max(size(last.box), size(box));
  };

  const addLine = (
    stroke: Stroke,
    fit: { a: Point2; b: Point2; confidence: number },
    cause: number,
  ) => {
    const others = scene.all().filter(isLine);
    const line = add({
      id: scene.nextId("l"),
      kind: "line",
      label: "straight line",
      box: strokeBox(stroke),
      confidence: fit.confidence,
      strokes: [stroke.id],
      geom: { a: fit.a, b: fit.b },
    });
    recognized(line.id, { kind: "line" }, cause);
    const found = [line.id];
    for (const other of others) {
      const at = crossingPoint(ends(other), ends(line));
      if (!at) continue;
      const crossing = add({
        id: scene.nextId("x"),
        kind: "crossing",
        label: "crossing",
        relations: [
          { type: "on", to: other.id },
          { type: "on", to: line.id },
        ],
        box: [at[0], at[1], 0, 0],
        confidence: Math.min(other.confidence, line.confidence),
        geom: { at },
      });
      scene.update(other.id, (o) => ({
        ...o,
        relations: [...o.relations, { type: "crosses", to: line.id }],
      }));
      scene.update(line.id, (o) => ({
        ...o,
        relations: [...o.relations, { type: "crosses", to: other.id }],
      }));
      recognized(crossing.id, { kind: "crossing" }, cause);
      found.push(crossing.id);
    }
    return found;
  };

  /** Reads a closed group: a one-stroke shape, else a symbol. */
  const read = (g: Group) => {
    // In drawing order, also when recent symbols were merged in (D110).
    const drawn = g.strokes
      .map((id) => strokes.get(id))
      .filter((s): s is Stroke => s !== undefined)
      .sort((a, b) => a.t0 - b.t0);
    if (drawn.length === 0) return;

    if (drawn.length === 1) {
      const shape = classifyShape(drawn[0]!);
      // D183: a round stroke your examples are sure is a letter (an O you taught) is the letter,
      // not a circle. The cards alone can't say so: the O card reads most round strokes as O.
      const known = shape.kind !== null && handwriting ? matcher?.match(drawn) : undefined;
      if (shape.kind !== null && !(known?.sure && known.label !== NOT_A_LETTER)) {
        const object = add({
          id: scene.nextId({ box: "sb", circle: "sc", arrow: "sa" }[shape.kind]),
          kind: shape.kind,
          label: shape.kind,
          box: strokeBox(drawn[0]!),
          confidence: shape.confidence,
          strokes: [drawn[0]!.id],
          ...(shape.kind === "arrow" ? { geom: { a: shape.a, b: shape.b } } : {}),
        });
        recognized(object.id, { kind: shape.kind }, g.lastSeq);
        // With handwriting on, a small stroke landing on it soon after can still join it: a Q's
        // tail on its circle (D183).
        if (handwriting)
          recent = [
            ...recent,
            { ...g, absorbed: [], symbol: object.id, strokes: [drawn[0]!.id], box: object.box },
          ];
        return;
      }
    }

    const points = drawn.map((s) => s.points.map(([x, y]): Point2 => [x, y]));
    // The handwriting ability splits the group into letters, turns a tilted one upright and
    // reads each by the cards (D114, T51–T53). Two or more letters, or one the cards read
    // clearly, are a written word, never guessed as one symbol ($P against X and O only fits a
    // lone mark).
    const letters = handwriting ? readHandwriting(drawn, cards, matcher) : [];
    const ids = letters.map((l) => l.strokes.map((s) => s.id));
    // A mark you said isn't a letter (D182) is no part of a word; a lone one is a plain mark.
    const real = letters.filter((l) => l.reading.label !== NOT_A_LETTER);
    const isWord =
      real.length >= 2 || (letters.length === 1 && real.length === 1 && real[0]!.reading.clear);
    // The letter you're still writing waits for its name until you pause or move on.
    const newest = drawn.at(-1)!.id;
    const settled = clock.now() - g.lastEnd >= SETTLE_MS;
    const waiting = isWord && !settled ? ids.findIndex((l) => l.includes(newest)) : -1;
    // The word as read: a ? for each unsure letter, … for the one still being written (D116).
    const text = wordText(letters, waiting);
    const sets = isWord ? [] : symbolSetsFrom(packs());
    const result = sets.length
      ? createRecognizer(sets).recognize(points)
      : { label: "?", score: 0, alternatives: [], pack: undefined };
    const fields = {
      kind: isWord ? "word" : "symbol",
      label: isWord ? text : result.label,
      pack: isWord ? HANDWRITING : (result.pack ?? SHAPES_PACK),
      relations: [],
      box: boxOf(points.flat()),
      // A word is as sure as its least sure letter.
      confidence: isWord ? Math.min(...letters.map((l) => l.reading.score)) / 100 : result.score,
      strokes: drawn.map((s) => s.id),
    };
    // A late stroke re-reads the same symbol, so its id stays and the earlier reading is replaced.
    const again = g.symbol && scene.has(g.symbol) ? g.symbol : undefined;
    if (again) scene.update(again, (o) => ({ ...o, ...fields }));
    const symbol = again
      ? scene.get(again)!
      : add({ id: scene.nextId(isWord ? "w" : "y"), ...fields });
    for (const id of g.absorbed ?? []) {
      if (id === symbol.id || !scene.has(id)) continue;
      scene.remove(id);
      story.append({
        who: "fastbrain",
        type: "remove",
        target: id,
        detail: { into: symbol.id },
        cause: g.lastSeq,
      });
    }
    const gone = new Set([symbol.id, ...(g.absorbed ?? [])]);
    recent = [
      ...recent.filter((r) => !gone.has(r.symbol!)),
      { ...g, absorbed: [], symbol: symbol.id, strokes: drawn.map((s) => s.id), box: symbol.box },
    ];
    const reading = recognized(
      symbol.id,
      isWord
        ? ({ kind: "word", letters: ids, text } satisfies WordReading)
        : {
            kind: "symbol",
            label: result.label,
            score: result.score,
            alternatives: result.alternatives,
            ...(handwriting ? { letters: ids } : {}),
          },
      g.lastSeq,
    );
    sendLetters(symbol.id, letters, waiting, reading.seq);
    if (waiting >= 0) settleLater(symbol.id, g.lastEnd);
  };

  /**
   * Saves each letter of a written word or mark as an example of the label's letter at the same
   * place ("HELLO" on five letters), and names each letter by Claude. A label that doesn't fit
   * the letters saves nothing, and the `taught` event says why.
   */
  const teach = (book: ExampleBook, target: string, text: string, cause: number) => {
    const object = scene.get(target);
    if (!object) return;
    // A one-stroke circle, box or arrow can be taught too: "it's O" (D183).
    const shape = SHAPES.has(object.kind);
    if (!shape && object.kind !== "word" && object.kind !== "symbol") return;
    const drawn = (object.strokes ?? [])
      .map((id) => strokes.get(id))
      .filter((s): s is Stroke => s !== undefined)
      .sort((a, b) => a.t0 - b.t0);
    if (drawn.length === 0) return;
    // "not a letter" (or ∅) saves the whole mark as one example of NOT_A_LETTER (D182).
    const notALetter = /^(not a letter|∅)$/i.test(text.trim());
    const chars = notALetter ? [NOT_A_LETTER] : [...text.replace(/\s+/g, "")];
    const letters = readHandwriting(drawn, cards);
    // A lone mark Claude names with one character is that character, however it splits.
    const groups = chars.length === 1 ? [drawn] : letters.map((l) => l.strokes);
    const skipped =
      chars.length === 0
        ? "the label has no letters"
        : groups.length !== chars.length
          ? `the word has ${groups.length} letters but "${text}" has ${chars.length}`
          : chars.some((c) => c === "?")
            ? `"${text}" has a ? in it`
            : undefined;
    const at = wallClock();
    const saved = skipped
      ? []
      : groups.map((ink, i) => {
          const example = exampleFrom(ink, {
            id: `${at}-${target}-${i + 1}`,
            label: chars[i]!,
            from: "claude",
            at,
          });
          book.add(example);
          return { id: example.id, label: example.label, strokes: ink.map((s) => s.id) };
        });
    const taught = story.append({
      who: "fastbrain",
      type: "taught",
      target,
      detail: { text, examples: saved, ...(skipped ? { skipped } : {}) } satisfies TaughtDetail,
      cause,
    });
    // A shape you named with a letter is now that word (D183), with its letters listed.
    let because = taught.seq;
    if (shape && saved.length > 0) {
      const text = saved.map((e) => e.label).join("");
      scene.update(target, (o) => ({ ...o, kind: "word", pack: HANDWRITING, label: text }));
      const ids = groups.map((ink) => ink.map((s) => s.id));
      because = recognized(
        target,
        { kind: "word", letters: ids, text } satisfies WordReading,
        taught.seq,
      ).seq;
    }
    // Each letter now shows the name Claude gave it (D116).
    saved.forEach(({ label }, i) => {
      const ink = groups[i]!;
      // A lone mark named with one character keeps how it was read, turn and all, when it split
      // as one letter; else it's measured again as drawn.
      const letter = chars.length === 1 && letters.length !== 1 ? undefined : letters[i];
      const reading: LetterReading = {
        label,
        score: 100,
        clear: true,
        guesses: [{ char: label, score: 100 }],
        via: "claude",
      };
      const detail: LetterEventDetail = {
        index: i + 1,
        of: saved.length,
        strokes: ink.map((s) => s.id),
        features: letter?.features ?? letterFeatures(ink),
        reading,
        ...(letter?.turn ? { turn: letter.turn } : {}),
      };
      story.append({ who: "fastbrain", type: "letter", target, detail, cause: because });
    });
  };

  /** "HELLO", with ? for an unsure letter and … for the one still being written. */
  const wordText = (letters: readonly ReadLetter[], waiting: number) =>
    letters
      .map((l, i) =>
        i === waiting ? "…" : l.reading.label === NOT_A_LETTER ? "" : l.reading.label,
      )
      .join("");

  /**
   * A `letter` event for each letter that's new, whose strokes changed, or that just got its
   * name: an unchanged letter measures and reads the same, and the word's reading lists them all.
   */
  const sendLetters = (
    word: string,
    letters: readonly ReadLetter[],
    waiting: number,
    cause: number,
  ) => {
    const key = (strokeIds: readonly unknown[]) => [...strokeIds].map(String).sort().join(" ");
    const sent = new Set(
      story
        .all()
        .filter((e) => e.type === "letter" && e.target === word)
        .map((e) => {
          const ids = Array.isArray(e.detail?.["strokes"]) ? e.detail["strokes"] : [];
          const state = e.detail?.["reading"] ? "named" : e.detail?.["waiting"] ? "waiting" : "";
          return `${key(ids)}|${state}`;
        }),
    );
    letters.forEach(({ strokes: ink, features, reading, turn }, i) => {
      const k = key(ink.map((s) => s.id));
      if (sent.has(`${k}|named`) || (i === waiting && sent.has(`${k}|waiting`))) return;
      const detail: LetterEventDetail = {
        index: i + 1,
        of: letters.length,
        strokes: ink.map((s) => s.id),
        features,
        ...(i === waiting ? { waiting: true } : { reading }),
        ...(turn ? { turn } : {}),
      };
      story.append({ who: "fastbrain", type: "letter", target: word, detail, cause });
    });
  };

  /** Names a word's last letter once you've paused (SETTLE_MS after its last stroke). */
  const settling = new Map<string, () => void>();
  const settleLater = (word: string, lastEnd: number) => {
    settling.get(word)?.();
    const wait = Math.max(0, lastEnd + SETTLE_MS - clock.now());
    settling.set(
      word,
      clock.after(wait, () => settle(word)),
    );
  };
  const settle = (word: string) => {
    settling.delete(word);
    // Still being written: the next reading names it.
    if (group?.symbol === word) return;
    const object = scene.get(word);
    if (!object || object.kind !== "word") return;
    const drawn = (object.strokes ?? [])
      .map((id) => strokes.get(id))
      .filter((s): s is Stroke => s !== undefined)
      .sort((a, b) => a.t0 - b.t0);
    const letters = readHandwriting(drawn, cards, matcher);
    const ids = letters.map((l) => l.strokes.map((s) => s.id));
    const text = wordText(letters, -1);
    scene.update(word, (o) => ({ ...o, label: text }));
    const last = recent.find((r) => r.symbol === word);
    const reading = recognized(
      word,
      { kind: "word", letters: ids, text } satisfies WordReading,
      last?.lastSeq ?? story.all().at(-1)!.seq,
    );
    sendLetters(word, letters, -1, reading.seq);
  };

  const close = () => {
    const g = group;
    if (!g) return;
    group = undefined;
    g.cancel();
    read(g);
  };

  return {
    onStroke(stroke, strokeEvent) {
      const verdict = fitLine(stroke);
      if (verdict.line && verdict.fit.length >= INSTANT_LINE_LENGTH) {
        close(); // a long line ends whatever was being drawn
        return addLine(stroke, verdict.fit, strokeEvent.seq);
      }
      if (group && !joins(group, stroke)) close();
      // D110: a late stroke close by reopens a symbol read in the last 2 s. One that reaches
      // several (an H's bar after its legs were read apart) brings them all into one group, read
      // again as one; the first keeps its id and the others are removed when it is read.
      recent = recent.filter((r) => r.symbol && scene.has(r.symbol));
      const reached = recent.filter((r) => r.symbol !== group?.symbol && rejoins(r, stroke));
      if (!group && reached.length > 0) {
        const [first] = reached;
        group = { ...first!, strokes: [...first!.strokes], absorbed: [], cancel: () => {} };
      }
      if (group)
        for (const r of reached) {
          if (r.symbol === group.symbol) continue;
          group.strokes.unshift(...r.strokes.filter((id) => !group!.strokes.includes(id)));
          group.box = union(group.box, r.box);
          if (group.symbol) group.absorbed = [...(group.absorbed ?? []), r.symbol!];
          else group.symbol = r.symbol;
        }
      const box = strokeBox(stroke);
      if (group) {
        group.cancel();
        group.strokes.push(stroke.id);
        group.box = union(group.box, box);
        group.lastEnd = Math.max(group.lastEnd, strokeEnd(stroke));
        group.lastSeq = strokeEvent.seq;
      } else {
        group = {
          strokes: [stroke.id],
          box,
          lastEnd: strokeEnd(stroke),
          lastSeq: strokeEvent.seq,
          cancel: () => {},
        };
      }
      group.cancel = clock.after(GROUP_MS, close);
      return [];
    },

    flush: close,

    madeFrom(strokeId) {
      const made = scene
        .all()
        .filter((o) => o.pack !== "builtin" && o.strokes?.includes(strokeId))
        .map((o) => o.id);
      const crossings = scene
        .all()
        .filter((o) => o.kind === "crossing" && o.relations.some((r) => made.includes(r.to)))
        .map((o) => o.id);
      return [...made, ...crossings];
    },
  };
}
