import type { Story } from "@visthinker/core";
import { useCallback, useRef, useSyncExternalStore } from "react";

/** A number that goes up with each new event, so the view re-reads the scene. */
export function useStoryVersion(story: Story): number {
  const version = useRef(story.all().length);
  const subscribe = useCallback(
    (notify: () => void) =>
      story.subscribe((event) => {
        version.current = event.seq;
        notify();
      }),
    [story],
  );
  return useSyncExternalStore(subscribe, () => version.current);
}
