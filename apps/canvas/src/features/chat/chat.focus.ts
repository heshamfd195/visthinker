// A reply dot jumps to its message (D136): open the chat, then scroll the message into view.
import { useUi } from "../shell/index.ts";

const FLASH = ["ring-1", "ring-ring"];

/** Opens the chat and scrolls the message with this seq into view, flashing it briefly. */
export function focusMessage(seq: number): void {
  useUi.getState().set({ chatOpen: true });
  // Two frames: the first lets the opened thread render, the second finds the message.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-seq="${seq}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      el.classList.add(...FLASH);
      setTimeout(() => el.classList.remove(...FLASH), 1200);
    }),
  );
}
