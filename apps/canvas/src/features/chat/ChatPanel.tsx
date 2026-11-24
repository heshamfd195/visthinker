// The chat with Claude (T43 · T44): the thread, chips that point at the canvas (D126 · D135),
// the status line (D134) and a plain text box, no paperclip, no microphone (D137).
import type { VisEvent } from "@visthinker/contract";
import { ChevronDown, ChevronUp, SendHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "../../shared/cn.ts";
import { Button, Input, Surface, Tip } from "../../shared/ui/index.ts";
import { useUi } from "../shell/index.ts";
import { chatStatus, lastClaudeWords, threadFor, type ThreadItem } from "./chat.utils.ts";

export interface ChatPanelProps {
  events: VisEvent[];
  /** The chat this panel shows, inside the project (D125). */
  chat: string;
  listening: boolean;
  connected: boolean;
  onSend(text: string, refs: string[]): void;
  onAnswer(seq: number, choice: string): void;
}

/** A target id; hovering it highlights the object on the canvas (D126). */
function Chip({ id }: { id: string }) {
  const set = useUi((s) => s.set);
  const pointAt = useUi((s) => s.pointAt);
  return (
    <span
      onMouseEnter={() => set({ pointAt: id })}
      onMouseLeave={() => set({ pointAt: undefined })}
      className={cn(
        "ml-1 inline-flex h-4 cursor-default items-center rounded border px-1 align-middle font-sans text-[10px] text-muted-foreground",
        pointAt === id && "bg-accent text-accent-foreground",
      )}
    >
      {id}
    </span>
  );
}

const Chips = ({ ids }: { ids: readonly (string | undefined)[] }) => (
  <>
    {ids
      .filter((id): id is string => !!id)
      .map((id) => (
        <Chip key={id} id={id} />
      ))}
  </>
);

function ClaudeLine({
  from,
  serif,
  children,
}: {
  from: "claude" | "fastbrain";
  serif: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Sparkles
        aria-label={from === "fastbrain" ? "Fast Brain" : "Claude"}
        className="mt-1 size-3 shrink-0 text-muted-foreground"
      />
      <div className={cn("min-w-0 flex-1 text-sm leading-snug", serif && "font-serif")}>
        {children}
      </div>
    </div>
  );
}

const Mine = ({ children }: { children: ReactNode }) => (
  <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-accent px-2.5 py-1.5 text-sm leading-snug text-accent-foreground">
    {children}
  </div>
);

function Item({
  item,
  serif,
  answer,
}: {
  item: ThreadItem;
  serif: boolean;
  answer(seq: number, choice: string): void;
}) {
  switch (item.kind) {
    case "claude":
      return (
        <ClaudeLine from={item.from} serif={serif}>
          {item.text}
          <Chips ids={[item.target]} />
          {item.choices.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 font-sans">
              {item.choices.map((c, i) => (
                <Button
                  key={c}
                  size="sm"
                  variant={i === 0 ? "default" : "outline"}
                  className="h-7"
                  onClick={() => answer(item.seq, c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          )}
          {item.answer !== undefined && (
            <div className="mt-1 font-sans text-xs text-muted-foreground">
              You answered: {item.answer}
            </div>
          )}
        </ClaudeLine>
      );
    case "you":
      return (
        <Mine>
          {item.text}
          <Chips ids={[item.target, ...item.refs]} />
        </Mine>
      );
    case "propose":
      return (
        <div className="rounded-md border p-2 text-sm">
          <div className="flex items-center gap-1.5">
            <Sparkles aria-hidden className="size-3 shrink-0 text-muted-foreground" />
            <span className={cn("min-w-0 flex-1", serif && "font-serif")}>
              {item.text}
              <Chips ids={[item.target]} />
            </span>
          </div>
          {item.answered ? (
            <div className="mt-1 text-xs text-muted-foreground">
              {/^(accept|yes|ok)$/i.test(item.answer ?? "") ? "Applied" : "Dismissed"}
            </div>
          ) : (
            <div className="mt-1.5 flex gap-1.5">
              {/* Any choice but accept leaves the drawing as it is (actor.answer). */}
              <Button size="sm" className="h-7" onClick={() => answer(item.seq, "accept")}>
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => answer(item.seq, "decline")}
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
      );
  }
}

export function ChatPanel({
  events,
  chat,
  listening,
  connected,
  onSend,
  onAnswer,
}: ChatPanelProps) {
  const chatOpen = useUi((s) => s.chatOpen);
  const layout = useUi((s) => s.layout);
  const selection = useUi((s) => s.selection);
  const serif = useUi((s) => s.claudeSerif);
  const set = useUi((s) => s.set);

  const [text, setText] = useState("");
  /** Answers given here, so the buttons go at once, before the answer event comes back. */
  const [clicked, setClicked] = useState<ReadonlyMap<number, string>>(new Map());
  const end = useRef<HTMLDivElement>(null);

  const thread = threadFor(events, chat, clicked);
  const last = lastClaudeWords(events, chat);
  const status = chatStatus(listening, connected);

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect must not.
    if (chatOpen) end.current?.scrollIntoView({ block: "end" });
  }, [chatOpen, thread.length]);

  // Focus hides everything but one button (D121).
  if (layout === "focus") return null;

  const answer = (seq: number, choice: string) => {
    setClicked((m) => new Map(m).set(seq, choice));
    onAnswer(seq, choice);
  };

  const send = (ev: FormEvent) => {
    ev.preventDefault();
    const t = text.trim();
    if (!t) return;
    // Whatever is selected travels with the message (D135).
    onSend(t, selection);
    setText("");
    if (selection.length > 0) set({ selection: [] });
  };

  const input = (
    <form onSubmit={send} className="flex flex-col gap-1.5">
      {selection.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>with:</span>
          <span className="flex min-w-0 flex-wrap gap-1">
            {selection.map((id) => (
              <Chip key={id} id={id} />
            ))}
          </span>
          <Tip label="Clear the selection">
            <button
              type="button"
              aria-label="Clear the selection"
              onClick={() => set({ selection: [] })}
              className="ml-0.5 rounded p-0.5 hover:bg-accent"
            >
              <X className="size-3" />
            </button>
          </Tip>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Input
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          placeholder="Message Claude"
          aria-label="Message Claude"
          maxLength={2000}
        />
        <Tip label="Send">
          <Button
            type="submit"
            size="icon-sm"
            variant="ghost"
            aria-label="Send"
            disabled={!text.trim()}
          >
            <SendHorizontal />
          </Button>
        </Tip>
      </div>
    </form>
  );

  const statusLine = (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-1.5 rounded-full",
          listening && connected ? "bg-foreground" : "border border-muted-foreground",
        )}
      />
      {status}
    </p>
  );

  if (!chatOpen) {
    return (
      <Surface className="flex w-[380px] flex-col gap-1.5 p-2">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              serif && "font-serif",
              !last && "text-muted-foreground",
            )}
          >
            {last ?? "Nothing from Claude yet."}
          </span>
          <Tip label="Open the chat" side="top">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open the chat"
              onClick={() => set({ chatOpen: true })}
            >
              <ChevronUp />
            </Button>
          </Tip>
        </div>
        {/* Collapsed keeps one line; the status shows only when a message would not be read now (D134). */}
        {!(listening && connected) && statusLine}
        {input}
      </Surface>
    );
  }

  return (
    <Surface className="flex w-[380px] flex-col">
      <header className="flex h-9 shrink-0 items-center border-b pr-1 pl-3 text-xs font-medium">
        Chat
        <Tip label="Collapse" side="top">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Collapse the chat"
            className="ml-auto"
            onClick={() => set({ chatOpen: false })}
          >
            <ChevronDown />
          </Button>
        </Tip>
      </header>
      <div className="max-h-[40vh] min-h-0 overflow-y-auto px-3 py-2">
        {thread.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            Say something, or draw and Claude will join in.
          </p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {thread.map((item) => (
              <li key={item.seq} data-seq={item.seq} className="rounded-md transition-shadow">
                <Item item={item} serif={serif} answer={answer} />
              </li>
            ))}
          </ol>
        )}
        <div ref={end} aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5 border-t p-2">
        {statusLine}
        {input}
      </div>
    </Surface>
  );
}
