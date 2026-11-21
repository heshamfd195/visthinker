// The events box (T45 · D127): what happened, in plain words, with Claude's calls among them.
// A row's raw JSON shows on a click, and the canvas points at what the row is about.
import type { VisEvent } from "@visthinker/contract";
import type { CallRecord } from "@visthinker/core";
import { ChevronDown, CircleAlert, Copy, Download, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../shared/cn.ts";
import { Button, Surface, Tip } from "../../shared/ui/index.ts";
import { useUi } from "../shell/index.ts";
import {
  FILTERS,
  isProblem,
  matches,
  mergeRows,
  mmss,
  rowJson,
  rowTarget,
  rowText,
  status,
  statusText,
  type EventsFilter,
  type Row,
  type Status,
} from "./events.utils.ts";

export interface EventsBoxProps {
  events: VisEvent[];
  calls: CallRecord[];
  listening: boolean;
  /** Whether the bridge to Claude is up at all. */
  connected: boolean;
  /** Clock time Claude got events and hasn't called back yet, else undefined. */
  thinkingSince: number | undefined;
  /** The session clock, in ms. */
  now: () => number;
}

/** Re-renders every `ms` while `on`, so the thinking seconds and the clock stay live. */
function useTick(on: boolean, ms: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [on, ms]);
}

function StatusDot({ status: s }: { status: Status }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        s === "listening" && "bg-foreground",
        s === "thinking" && "animate-pulse bg-foreground",
        (s === "away" || s === "offline") && "border border-muted-foreground bg-transparent",
      )}
    />
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function EventsBox({
  events,
  calls,
  listening,
  connected,
  thinkingSince,
  now,
}: EventsBoxProps) {
  const eventsOpen = useUi((s) => s.eventsOpen);
  const layout = useUi((s) => s.layout);
  const pointAt = useUi((s) => s.pointAt);
  const set = useUi((s) => s.set);

  const [filter, setFilter] = useState<EventsFilter>("all");
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  /** How many rows were showing when paused; the list stays frozen there. */
  const [pausedAt, setPausedAt] = useState<number | undefined>(undefined);
  /** How many events there were when the box was last open, for the badge. */
  const [seen, setSeen] = useState(events.length);
  const end = useRef<HTMLLIElement>(null);

  const s = status(listening, thinkingSince, connected);
  useTick(s === "thinking" || eventsOpen, s === "thinking" ? 100 : 1000);
  const label = statusText(s, thinkingSince === undefined ? 0 : now() - thinkingSince);

  useEffect(() => {
    if (eventsOpen) setSeen(events.length);
  }, [eventsOpen, events.length]);

  const all = useMemo(() => mergeRows(events, calls), [events, calls]);
  const rows = (pausedAt === undefined ? all : all.slice(0, pausedAt)).filter((r) =>
    matches(r, filter),
  );

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect must not.
    if (eventsOpen && pausedAt === undefined) end.current?.scrollIntoView({ block: "end" });
  }, [eventsOpen, pausedAt, rows.length, filter]);

  // Focus hides everything but one button (D121).
  if (layout === "focus") return null;

  if (!eventsOpen) {
    const unseen = Math.max(0, events.length - seen);
    return (
      <Surface className="w-fit">
        <button
          type="button"
          onClick={() => set({ eventsOpen: true })}
          className="flex h-8 items-center gap-2 rounded-lg px-3 text-xs hover:bg-accent"
          aria-label={`${label}. Open the events box`}
        >
          <StatusDot status={s} />
          <span className="tabular-nums">{label}</span>
          {unseen > 0 && (
            <span className="rounded-full bg-secondary px-1.5 text-[11px] text-secondary-foreground tabular-nums">
              {unseen > 99 ? "99+" : unseen}
            </span>
          )}
        </button>
      </Surface>
    );
  }

  const toggle = (row: Row) => {
    const target = rowTarget(row);
    const closing = open.has(row.key);
    setOpen((o) => {
      const next = new Set(o);
      if (closing) next.delete(row.key);
      else next.add(row.key);
      return next;
    });
    // The canvas highlights what the row is about (D127).
    if (target) set({ pointAt: closing && pointAt === target ? undefined : target });
  };

  return (
    <Surface className="flex max-h-[45vh] w-[330px] flex-col overflow-hidden">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b pr-1 pl-3 text-xs">
        <StatusDot status={s} />
        <span className="truncate tabular-nums">{label}</span>
        <span className="ml-auto text-muted-foreground tabular-nums">{mmss(now())}</span>
        <Tip label="Collapse">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Collapse the events box"
            onClick={() => set({ eventsOpen: false })}
          >
            <ChevronDown />
          </Button>
        </Tip>
      </header>

      <div role="group" aria-label="Filter events" className="flex shrink-0 gap-1 px-2 py-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent",
              filter === f.value && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto py-1 font-mono text-[11px]">
        {rows.length === 0 && (
          <li className="px-3 py-2 text-muted-foreground">
            {filter === "all" ? "Nothing yet. Draw or place something." : "Nothing here."}
          </li>
        )}
        {rows.map((row) => {
          const expanded = open.has(row.key);
          const target = rowTarget(row);
          const fromClaude = row.kind === "call" || row.event.who === "claude";
          return (
            <li key={row.key}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggle(row)}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-0.5 text-left hover:bg-accent",
                  target && target === pointAt && "bg-accent",
                  !fromClaude &&
                    row.kind === "event" &&
                    row.event.who !== "user" &&
                    "text-muted-foreground",
                )}
              >
                <span className="shrink-0 text-muted-foreground tabular-nums">{mmss(row.at)}</span>
                <span className="min-w-0 flex-1 break-words">{rowText(row)}</span>
                {isProblem(row) && (
                  <CircleAlert aria-label="problem" className="mt-0.5 size-3 shrink-0" />
                )}
              </button>
              {expanded && (
                <pre className="mx-3 mb-1 overflow-x-auto rounded-md bg-muted p-2 text-[10px] leading-snug text-muted-foreground">
                  {rowJson(row)}
                </pre>
              )}
            </li>
          );
        })}
        <li ref={end} aria-hidden />
      </ol>

      <footer className="flex h-9 shrink-0 items-center gap-1 border-t px-1 text-xs">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={pausedAt !== undefined}
          onClick={() => setPausedAt((p) => (p === undefined ? all.length : undefined))}
        >
          {pausedAt === undefined ? <Pause /> : <Play />}
          {pausedAt === undefined ? "Pause" : "Resume"}
        </Button>
        <Tip label="Copy the events as JSON">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy the events as JSON"
            onClick={() => void navigator.clipboard?.writeText(JSON.stringify(events, null, 2))}
          >
            <Copy />
          </Button>
        </Tip>
        <Tip label="Export events.json">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Export events.json"
            onClick={() => download("events.json", JSON.stringify(events, null, 2))}
          >
            <Download />
          </Button>
        </Tip>
        <span className="ml-auto pr-2 text-muted-foreground tabular-nums">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </footer>
    </Surface>
  );
}
