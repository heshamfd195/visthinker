// Every drawn item's Konva node carries its id as a name, so the selection's handles can find
// the nodes to preview a resize or rotate on, whichever layer draws them.
export const itemName = (id: string): string => `item-${id}`;

/** The id an item's node was named with, or undefined for anything else. */
export function itemIdOf(name: string): string | undefined {
  const match = /(?:^|\s)item-(\S+)/.exec(name);
  return match?.[1];
}
