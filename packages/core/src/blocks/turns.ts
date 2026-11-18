// The `turns` block (D80 · D92): whose move it is, and which mark each player makes.
// The turn comes from the marks on the board, so an undone mark gives the turn back.
import type { TurnsRules, Who } from "@visthinker/contract";

export interface Turns {
  /** Whose move it is after `movesMade` marks. */
  whoseTurn(movesMade: number): Who;
  /** The mark a player makes, e.g. user → "X". */
  markFor(who: Who): string | undefined;
}

export function createTurns(rules: TurnsRules): Turns {
  return {
    whoseTurn: (movesMade) => rules.order[movesMade % rules.order.length]!,
    markFor: (who) => rules.marks[who],
  };
}
