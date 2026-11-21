// The projects drawer, top left (D125): a project is one canvas with many chats with Claude.
import type { ProjectMeta } from "@visthinker/contract";
import {
  CircleQuestionMark,
  FileUp,
  Menu,
  MessageSquare,
  PanelLeftClose,
  Plus,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../../shared/cn.ts";
import { Button, Input, Surface, Tip } from "../../shared/ui/index.ts";
import { useUi } from "../shell/index.ts";
import { ago, findProjects } from "./projects.utils.ts";

export type SaveState = "saved" | "saving" | "unsaved" | "offline";

export interface ProjectsMenuProps {
  projects: ProjectMeta[];
  current: ProjectMeta;
  /** The id of the open chat. */
  chat: string;
  connected: boolean;
  saving: SaveState;
  onOpen(id: string): void;
  onNew(): void;
  onRename(name: string): void;
  onOpenChat(id: string): void;
  onNewChat(): void;
  onOpenFile(file: File): void;
}

const SAVE_HINT: Record<SaveState, string> = {
  saved: "saved",
  saving: "saving…",
  unsaved: "unsaved",
  offline: "offline",
};

/** The time, ticking once a minute so "5 min" stays true. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function ProjectsMenu(props: ProjectsMenuProps) {
  const open = useUi((s) => s.projectsOpen);
  const set = useUi((s) => s.set);
  if (!open) {
    return (
      <Surface className="absolute top-3 left-3 flex max-w-72 items-center gap-1.5 p-1 pr-3">
        <Tip label="Projects">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open projects"
            onClick={() => set({ projectsOpen: true })}
          >
            <Menu />
          </Button>
        </Tip>
        <span className="truncate text-sm text-muted-foreground">{props.current.name}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground/70">
          {SAVE_HINT[props.saving]}
        </span>
      </Surface>
    );
  }
  return <Drawer {...props} onClose={() => set({ projectsOpen: false })} />;
}

function Drawer({
  projects,
  current,
  chat,
  connected,
  onOpen,
  onNew,
  onRename,
  onOpenChat,
  onNewChat,
  onOpenFile,
  onClose,
}: ProjectsMenuProps & { onClose(): void }) {
  const set = useUi((s) => s.set);
  const now = useNow();
  const [search, setSearch] = useState("");
  const file = useRef<HTMLInputElement>(null);
  // The open project is always listed, even if the list from disk hasn't caught up yet.
  const all = projects.some((p) => p.id === current.id) ? projects : [current, ...projects];
  const shown = findProjects(all, search);

  return (
    <Surface
      aria-label="Projects"
      className="absolute top-3 left-3 flex h-[calc(100%-76px)] w-[250px] flex-col"
    >
      <header className="flex items-center justify-between px-3 pt-2.5 pb-2">
        <span className="text-sm font-semibold">Visthinker</span>
        <Tip label="Collapse">
          <Button variant="ghost" size="icon-sm" aria-label="Collapse projects" onClick={onClose}>
            <PanelLeftClose />
          </Button>
        </Tip>
      </header>

      <div className="flex gap-1.5 px-3 pb-2">
        <Input
          type="search"
          placeholder="Search projects"
          aria-label="Search projects"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button size="sm" variant="secondary" onClick={onNew}>
          <Plus />
          New
        </Button>
      </div>

      <div className="px-3 pt-1 pb-1.5 text-xs text-muted-foreground">Your projects</div>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
        {shown.map((p) =>
          p.id === current.id ? (
            <li key={p.id}>
              <CurrentCard
                project={p}
                chat={chat}
                now={now}
                onRename={onRename}
                onOpenChat={onOpenChat}
                onNewChat={onNewChat}
              />
            </li>
          ) : (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-accent"
              >
                <Thumb src={p.thumbnail} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ago(p.updatedAt, now)}
                  </span>
                </span>
              </button>
            </li>
          ),
        )}
        {shown.length === 0 && (
          <li className="px-1.5 py-2 text-xs text-muted-foreground">No project matches.</li>
        )}
      </ul>

      <footer className="space-y-0.5 border-t p-2">
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onOpenFile(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => file.current?.click()}
        >
          <FileUp />
          Open from file
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => set({ settingsOpen: true })}
        >
          <CircleQuestionMark />
          Help and shortcuts
        </Button>
        <div className="flex items-center gap-2 px-3 pt-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              connected ? "bg-foreground" : "border border-muted-foreground",
            )}
          />
          {connected ? "Claude Code connected" : "Not connected to Claude"}
        </div>
      </footer>
    </Surface>
  );
}

/** The open project: highlighted, renamed by double-click, with its chats underneath. */
function CurrentCard({
  project,
  chat,
  now,
  onRename,
  onOpenChat,
  onNewChat,
}: {
  project: ProjectMeta;
  chat: string;
  now: number;
  onRename(name: string): void;
  onOpenChat(id: string): void;
  onNewChat(): void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);

  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== project.name) onRename(name.slice(0, 80));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <div className="rounded-md bg-accent p-1.5" aria-current="true">
      <div className="flex items-center gap-2.5">
        <Thumb src={project.thumbnail} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              autoFocus
              aria-label="Project name"
              maxLength={80}
              className="h-6 px-1.5"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={onKey}
            />
          ) : (
            <span
              className="block cursor-text truncate text-sm font-medium"
              title="Double-click to rename"
              onDoubleClick={() => {
                setDraft(project.name);
                setEditing(true);
              }}
            >
              {project.name}
            </span>
          )}
          <span className="block text-xs text-muted-foreground">{ago(project.updatedAt, now)}</span>
        </div>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {project.chats.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              aria-current={c.id === chat || undefined}
              onClick={() => onOpenChat(c.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs",
                "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                c.id === chat && "bg-background/60 text-foreground",
              )}
            >
              <MessageSquare className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="shrink-0">{ago(c.createdAt, now)}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            New chat
          </button>
        </li>
      </ul>
    </div>
  );
}

function Thumb({ src }: { src: string | undefined }) {
  return src ? (
    <img src={src} alt="" className="h-9 w-12 shrink-0 rounded border object-cover" />
  ) : (
    <span aria-hidden className="block h-9 w-12 shrink-0 rounded border bg-muted" />
  );
}
