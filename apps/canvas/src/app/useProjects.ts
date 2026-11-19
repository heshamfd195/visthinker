// Projects (D125 · D142): one canvas with many chats, saved on disk through the bridge. Opening
// the canvas reopens the latest project; every change is saved a moment later. Without a bridge
// the project lives only in this tab, and the drawer says so.
import type { Project, ProjectMeta } from "@visthinker/contract";
import { readSnapshot, takeSnapshot } from "@visthinker/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { newChat, newProjectMeta, type SaveState } from "../features/projects/index.ts";
import type { Canvas, Session } from "./session.ts";

/** How long after the last change a project is saved. */
export const SAVE_DELAY_MS = 1_500;

export interface Projects {
  projects: ProjectMeta[];
  current: ProjectMeta;
  chat: string;
  saving: SaveState;
  open(id: string): Promise<void>;
  create(): Promise<void>;
  rename(name: string): void;
  openChat(id: string): void;
  newChat(): void;
  openFile(file: File): Promise<void>;
  saveNow(): Promise<void>;
  exportFile(): void;
  /** A problem to show, e.g. a project that couldn't be read. */
  error: string | undefined;
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function useProjects(
  session: Session,
  canvas: Canvas,
  /** A small picture of the canvas for the project card. */
  thumbnail: () => string | undefined,
): Projects {
  const http = session.http;
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [current, setCurrent] = useState<ProjectMeta>(() => newProjectMeta("Untitled", Date.now()));
  const [chat, setChat] = useState("main");
  const [saving, setSaving] = useState<SaveState>(http ? "saved" : "offline");
  const [error, setError] = useState<string>();
  const meta = useRef(current);
  meta.current = current;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ready = useRef(!http);

  const project = useCallback(
    (m: ProjectMeta): Project => {
      const picture = thumbnail();
      return {
        meta: { ...m, updatedAt: Date.now(), ...(picture ? { thumbnail: picture } : {}) },
        snapshot: takeSnapshot(session.canvas()),
      };
    },
    [session, thumbnail],
  );

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (!http || !ready.current) return;
    setSaving("saving");
    try {
      const p = project(meta.current);
      await http.saveProject(p);
      setCurrent(p.meta);
      setProjects((list) => [p.meta, ...list.filter((x) => x.id !== p.meta.id)]);
      setSaving("saved");
    } catch (e) {
      setSaving("unsaved");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [http, project]);

  // Every change is saved a moment later.
  useEffect(
    () =>
      canvas.story.subscribe(() => {
        if (!http) return;
        setSaving("unsaved");
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
      }),
    [canvas, http, save],
  );

  const load = useCallback(
    async (id: string) => {
      if (!http) return;
      const p = await http.readProject(id);
      session.open(readSnapshot(p.snapshot));
      setCurrent(p.meta);
      setChat(p.meta.chats.at(-1)?.id ?? "main");
    },
    [http, session],
  );

  // Opening the canvas reopens the latest project, or starts the first one.
  useEffect(() => {
    if (!http) return;
    let stop = false;
    void (async () => {
      try {
        const list = await http.listProjects();
        if (stop) return;
        setProjects(list);
        if (list[0]) await load(list[0].id);
        ready.current = true;
        if (!list[0]) await save();
      } catch (e) {
        ready.current = true;
        setSaving("offline");
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      stop = true;
    };
  }, [http, load, save]);

  return {
    projects: projects.length ? projects : [current],
    current,
    chat,
    saving,
    error,
    async open(id) {
      if (id === meta.current.id) return;
      await save();
      try {
        await load(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    async create() {
      await save();
      const next = newProjectMeta("Untitled", Date.now());
      session.open();
      setCurrent(next);
      meta.current = next;
      setChat("main");
      await save();
    },
    rename(name) {
      const trimmed = name.trim().slice(0, 80);
      if (!trimmed) return;
      setCurrent((m) => ({ ...m, name: trimmed }));
      meta.current = { ...meta.current, name: trimmed };
      void save();
    },
    openChat: setChat,
    newChat() {
      const c = newChat(Date.now());
      const next = { ...meta.current, chats: [...meta.current.chats, c] };
      setCurrent(next);
      meta.current = next;
      setChat(c.id);
      void save();
    },
    async openFile(file) {
      try {
        const raw = JSON.parse(await file.text()) as Project;
        const parts = readSnapshot(raw.snapshot);
        await save();
        session.open(parts);
        const next = {
          ...newProjectMeta(raw.meta?.name ?? file.name, Date.now()),
          chats: raw.meta?.chats ?? [],
        };
        if (!next.chats.length) next.chats = newProjectMeta("x", Date.now()).chats;
        setCurrent(next);
        meta.current = next;
        setChat(next.chats.at(-1)!.id);
        await save();
      } catch (e) {
        setError(
          `That file isn't a Visthinker project: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    saveNow: save,
    exportFile() {
      const p = project(meta.current);
      download(
        `${p.meta.name.replace(/[^\w-]+/g, "-") || "project"}.visthinker.json`,
        JSON.stringify(p),
      );
    },
  };
}
