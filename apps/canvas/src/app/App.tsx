// The app (D119): Konva draws only the drawing, everything else is HTML on top (D144), in seven
// places that open, collapse or hide together (D121). This file wires the features to the core.
import type { Box, Mode, Point2, Stroke } from "@visthinker/contract";
import { MODES } from "@visthinker/contract";
import {
  currentMode,
  modeInfo,
  placeObject,
  recordStroke,
  requestTakeBack,
  sendMessage,
  setMode,
  moveObject,
  colorsFromStory,
  type CallRecord,
  type PlaceInput,
} from "@visthinker/core";
import type Konva from "konva";
import { Maximize, Minus, PanelsTopLeft, Plus, Settings as SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Stage } from "react-konva";
import { bridgeUrlFromPage } from "../adapters/ws-transport/index.ts";
import { ChatPanel, ReplyDots } from "../features/chat/index.ts";
import { EventsBox } from "../features/events/index.ts";
import { GridControl, GuidesLayer, LinesControl, snapPoint } from "../features/guides/index.ts";
import { InkLayer, type InkMode } from "../features/ink/index.ts";
import { LIBRARY_DRAG_TYPE, LibraryPanel, type LibraryItem } from "../features/library/index.ts";
import { ModeButton, ModeNote } from "../features/modes/index.ts";
import { markColors, ObjectsLayer, symbolTags } from "../features/objects/index.ts";
import { PacksPanel, type PackRow } from "../features/packs/index.ts";
import { ProjectsMenu } from "../features/projects/index.ts";
import { SettingsDialog } from "../features/settings/index.ts";
import { useUi } from "../features/shell/index.ts";
import { winningLine } from "../features/talk/index.ts";
import { Toolbar, useShortcuts, useToolbar } from "../features/toolbar/index.ts";
import { applyTheme, paint } from "../shared/theme.ts";
import { cn } from "../shared/cn.ts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Surface,
  Tip,
  TooltipProvider,
} from "../shared/ui/index.ts";
import { BookOpen, Package } from "lucide-react";
import type { BehaviourSettings } from "@visthinker/contract";
import type { PackListing } from "../adapters/bridge-http/index.ts";
import { createSession, type Canvas, type Session } from "./session.ts";
import { useFrame } from "./useFrame.ts";
import { useLinkStatus } from "./useLinkStatus.ts";
import { useProjects } from "./useProjects.ts";
import { useStoryVersion } from "./useStoryVersion.ts";
import { useWindowSize } from "./useWindowSize.ts";

const VERSION = "0.1.0";
const TEXT_SIZE = { s: "12px", m: "13px", l: "15px" } as const;

/** The canvas now: a new one each time a project opens. */
function useCanvas(session: Session): Canvas {
  return useSyncExternalStore(
    useCallback((notify) => session.onCanvas(notify), [session]),
    () => session.canvas(),
  );
}

/** Whether Claude waits for events, each call it made, and since when it has been thinking. */
function useClaude(canvas: Canvas, now: () => number) {
  const [listening, setListening] = useState(canvas.handler.listening());
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [thinkingSince, setThinkingSince] = useState<number>();
  useEffect(() => {
    setCalls([]);
    setThinkingSince(undefined);
    return canvas.handler.onActivity((record) => {
      setListening(canvas.handler.listening());
      if (!record) return;
      setCalls((list) => [...list.slice(-299), record]);
      // Claude got its events: it's thinking until its next call arrives.
      if (record.call === "wait_for_event") setThinkingSince(now());
      else setThinkingSince(undefined);
    });
  }, [canvas, now]);
  useEffect(() => {
    if (listening) setThinkingSince(undefined);
  }, [listening]);
  return { listening, calls, thinkingSince };
}

export function App() {
  const session = useMemo(
    () =>
      createSession({
        bridgeUrl: bridgeUrlFromPage(window.location.search),
        search: window.location.search,
      }),
    [],
  );
  const canvas = useCanvas(session);
  // A new canvas remounts everything that draws it.
  return <Workspace key={canvasKey(canvas)} session={session} canvas={canvas} />;
}

const keys = new WeakMap<Canvas, number>();
let nextKey = 1;
function canvasKey(canvas: Canvas): number {
  if (!keys.has(canvas)) keys.set(canvas, nextKey++);
  return keys.get(canvas)!;
}

function Workspace({ session, canvas }: { session: Session; canvas: Canvas }) {
  const link = useLinkStatus(session.transport);
  // Only the real bridge counts: on its own the page runs on a fake transport that is always ready.
  const connected = !!session.bridge && link === "ready";

  // Connect one tick after mount: React's dev mode mounts twice, and a socket from the throwaway
  // first mount would take the bridge's one tab slot (D82 ④). Cleanup cancels it before it opens.
  useEffect(() => {
    const bridge = session.bridge;
    if (!bridge || bridge.status() === "ready") return;
    let opened = false;
    const timer = setTimeout(() => {
      opened = true;
      bridge.start();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (opened && canvasKey(session.canvas()) !== canvasKey(canvas)) return;
      if (opened) bridge.close();
    };
  }, [session, canvas]);

  const ui = useUi();
  const screen = useWindowSize();
  const { tool, color } = useToolbar();
  const version = useStoryVersion(canvas.story);
  const objects = useFrame(canvas.renderer);
  const events = useMemo(() => canvas.story.all(), [canvas, version]);
  const now = useCallback(() => session.clock.now(), [session]);
  const claude = useClaude(canvas, now);
  const stage = useRef<Konva.Stage>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // The look (D128): theme, text size.
  useEffect(() => applyTheme(ui.theme), [ui.theme]);
  useEffect(() => {
    document.body.style.fontSize = TEXT_SIZE[ui.textSize];
  }, [ui.textSize]);

  const zoom = ui.zoom;
  const view = {
    x: -pan.x / zoom,
    y: -pan.y / zoom,
    width: screen.width / zoom,
    height: screen.height / zoom,
  };

  const thumbnail = useCallback(
    () => stage.current?.toDataURL({ pixelRatio: Math.min(0.2, 240 / screen.width) }),
    [screen.width],
  );
  const projects = useProjects(session, canvas, thumbnail);

  // Behaviour settings live on disk (D143).
  const [behaviour, setBehaviour] = useState<BehaviourSettings>();
  useEffect(() => {
    void session.http?.readSettings().then(setBehaviour, () => undefined);
  }, [session]);

  // Packs: what's loaded here, plus what the bridge has on disk or in the catalog (D122).
  const [listing, setListing] = useState<PackListing[]>([]);
  const [, setPackVersion] = useState(0);
  const refreshPacks = useCallback(() => {
    void session.http?.listPacks().then(setListing, () => undefined);
  }, [session]);
  useEffect(refreshPacks, [refreshPacks]);
  const packRows: PackRow[] = useMemo(() => {
    const rows = new Map<string, PackRow>();
    for (const name of session.registry.names()) {
      const pack = session.registry.get(name)!.pack["pack.json"];
      rows.set(name, {
        name,
        version: pack.version,
        source: "starter",
        installed: true,
        enabled: session.registry.enabled(name),
        yours: false,
      });
    }
    for (const p of listing) {
      const row = rows.get(p.name);
      if (row) rows.set(p.name, { ...row, source: p.source, yours: p.source === "local" });
      else
        rows.set(p.name, {
          name: p.name,
          version: p.version,
          source: p.source,
          installed: false,
          enabled: false,
          yours: p.source === "local",
        });
    }
    return [...rows.values()];
    // version changes when a pack loads or switches
  }, [session, listing, events.length]);

  // What's drawn: visible ink, objects, colours.
  const hidden = useMemo(() => {
    const out = new Set(canvas.history.hiddenStrokes());
    // Ink that gave way to a clean mark (a drawn X played as a move, T31).
    for (const o of objects) if (o.kind === "mark") for (const s of o.strokes ?? []) out.add(s);
    return out;
  }, [canvas, objects, version]);
  const strokes = useMemo(() => canvas.strokes.all(), [canvas, version]);
  const colors = useMemo(
    () => new Map([...colorsFromStory(events), ...markColors(events)]),
    [events],
  );
  const highlight = useMemo(() => winningLine(events), [events]);
  const tags = useMemo(() => (ui.showRead ? symbolTags(events) : new Map()), [events, ui.showRead]);

  const snap = useCallback(
    (p: Point2): Point2 =>
      ui.grid.snap && ui.grid.kind !== "none" ? snapPoint(p, ui.grid.size) : p,
    [ui.grid],
  );

  // Undo (D130 · D131): after Claude answered a game move, undo asks for a take-back first.
  const undo = useCallback(() => {
    if (canvas.history.takeBack()) {
      requestTakeBack(canvas.story, canvas.history);
      useUi.getState().set({ chatOpen: true });
      return;
    }
    canvas.history.undo();
  }, [canvas]);
  const redo = useCallback(() => canvas.history.redo(), [canvas]);
  const clear = useCallback(() => canvas.history.clear(), [canvas]);

  useShortcuts(
    useMemo(
      () => ({
        undo,
        redo,
        focus: () => {
          const s = useUi.getState();
          s.setLayout(s.layout === "focus" ? "collapsed" : "focus");
        },
        openAll: () => useUi.getState().setLayout("open"),
        settings: () => useUi.getState().set({ settingsOpen: true }),
      }),
      [undo, redo],
    ),
  );

  const onStroke = useCallback(
    (stroke: Stroke) => {
      // Record the stroke, then let the comparator read it (D64).
      const event = recordStroke(canvas.story, canvas.strokes, stroke);
      canvas.comparator.onStroke(stroke, event);
    },
    [canvas],
  );
  const onPlace = useCallback(
    (input: PlaceInput) => placeObject(canvas.story, canvas.scene, input),
    [canvas],
  );
  const onPlaceBoard = useCallback(
    (box: Box) => {
      try {
        canvas.games.placeBoard("tic-tac-toe", box);
      } catch (error) {
        console.warn(error instanceof Error ? error.message : error); // e.g. a board is already there
      }
    },
    [canvas],
  );
  const pick = useCallback((id: string | undefined, add: boolean) => {
    const { selection, set } = useUi.getState();
    if (!id) return set({ selection: add ? selection : [] });
    set({
      selection: add
        ? selection.includes(id)
          ? selection.filter((s) => s !== id)
          : [...selection, id]
        : [id],
    });
  }, []);

  // The library (D123): drop or click an item to place it.
  const placeItem = useCallback(
    (item: LibraryItem, at?: Point2) => {
      const [cx, cy] = snap(at ?? [view.x + view.width / 2, view.y + view.height / 2]);
      if (item.kind === "board") return onPlaceBoard([cx - 120, cy - 120, 240, 240]);
      if (item.kind === "box" || item.kind === "circle")
        return void onPlace({ kind: item.kind, box: [cx - 60, cy - 40, 120, 80], color });
      if (item.kind === "arrow")
        return void onPlace({
          kind: "arrow",
          box: [cx - 60, cy, 120, 0],
          color,
          ends: { a: [cx - 60, cy], b: [cx + 60, cy] },
        });
      if (item.kind === "symbol")
        return void onPlace({
          kind: "glyph",
          box: [cx - 24, cy - 24, 48, 48],
          color,
          label: item.glyph ?? item.name,
        });
      // A drawing of yours comes back as ink, read like any other (D64).
      const all = (item.strokes ?? []).flatMap((s) => s.points);
      const w = Math.max(0, ...all.map((p) => p[0]));
      const h = Math.max(0, ...all.map((p) => p[1]));
      for (const s of item.strokes ?? []) {
        onStroke({
          id: canvas.strokes.nextId(),
          t0: Math.round(now()),
          tool: "pen",
          color,
          width: s.width,
          points: s.points.map(([x, y, p, dt]) => [x + cx - w / 2, y + cy - h / 2, p, dt]),
        });
      }
    },
    [
      canvas,
      color,
      now,
      onPlace,
      onPlaceBoard,
      onStroke,
      snap,
      view.x,
      view.y,
      view.width,
      view.height,
    ],
  );

  const addSelection = useCallback((): LibraryItem | undefined => {
    const ids = new Set<string>();
    for (const id of useUi.getState().selection) {
      if (canvas.strokes.has(id)) ids.add(id);
      for (const s of canvas.scene.get(id)?.strokes ?? []) ids.add(s);
    }
    const picked = [...ids].map((id) => canvas.strokes.get(id)!).filter(Boolean);
    if (!picked.length) {
      window.alert("Select some ink first, with the select tool (V).");
      return undefined;
    }
    return {
      id: `yours-${Date.now()}`,
      group: "yours",
      name: "My drawing",
      kind: "drawing",
      strokes: picked.map((s) => ({ points: s.points, width: s.width })),
    };
  }, [canvas]);

  const message = useCallback(
    (text: string, refs: string[] = []) => {
      try {
        sendMessage(canvas.story, { text, refs, chat: projects.chat });
      } catch {
        // an empty message is simply not sent
      }
    },
    [canvas, projects.chat],
  );

  // Modes (D129 · D138): auto by default, or one picked by hand.
  const mode = currentMode(events);
  const infos = useMemo(
    () =>
      Object.fromEntries(
        MODES.flatMap((m) => {
          const info = modeInfo(session.registry, m);
          return info ? [[m, info]] : [];
        }),
      ),
    [session],
  );
  const previous = useMemo(() => {
    const changes = events.filter((e) => e.type === "mode");
    return currentMode(changes.slice(0, -1)).mode;
  }, [events]);
  const [noteGone, setNoteGone] = useState<number>();
  const pickMode = (m: Mode | "auto") =>
    m === "auto"
      ? setMode(canvas.story, session.registry, {
          mode: mode.mode,
          manual: false,
          by: "user",
          reason: "back to auto",
        })
      : setMode(canvas.story, session.registry, { mode: m, manual: true, by: "user" });

  const zoomBy = (factor: number) =>
    ui.set({ zoom: Math.min(4, Math.max(0.25, Math.round(zoom * factor * 100) / 100)) });

  const inkMode: InkMode =
    tool === "pen" ? "draw" : tool === "eraser" ? "erase" : tool === "select" ? "select" : "off";
  const ink = paint("ink", ui.canvas);
  const focus = ui.layout === "focus";

  return (
    <TooltipProvider>
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ background: paintCanvas(ui.canvas) }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) e.preventDefault();
        }}
        onDrop={(e) => {
          const raw = e.dataTransfer.getData(LIBRARY_DRAG_TYPE);
          if (!raw || !stage.current) return;
          e.preventDefault();
          stage.current.setPointersPositions(e.nativeEvent);
          const p = stage.current.getRelativePointerPosition();
          if (p) placeItem(JSON.parse(raw) as LibraryItem, [p.x, p.y]);
        }}
      >
        <Stage
          ref={stage}
          width={screen.width}
          height={screen.height}
          scaleX={zoom}
          scaleY={zoom}
          x={pan.x}
          y={pan.y}
          draggable={tool === "hand"}
          onDragEnd={(e) => {
            if (e.target === stage.current) setPan({ x: e.target.x(), y: e.target.y() });
          }}
          onWheel={(e) => {
            if (!e.evt.ctrlKey && !e.evt.metaKey) return;
            e.evt.preventDefault();
            zoomBy(e.evt.deltaY < 0 ? 1.1 : 1 / 1.1);
          }}
          style={{ touchAction: "none", cursor: tool === "hand" ? "grab" : undefined }}
        >
          <GuidesLayer {...view} color={ink} scale={zoom} />
          <InkLayer
            view={view}
            now={now}
            nextId={canvas.strokes.nextId}
            onStroke={onStroke}
            strokes={strokes}
            color={color}
            width={ui.penSize}
            smoothing={ui.smoothing}
            canvas={ui.canvas}
            mode={inkMode}
            onTap={(at) => canvas.games.tap(at)}
            onErase={(ids) => canvas.history.erase(ids)}
            onPick={pick}
            hidden={hidden}
          />
          <ObjectsLayer
            view={view}
            canvas={ui.canvas}
            objects={objects}
            colors={colors}
            tool={tool}
            color={color}
            highlight={highlight}
            tags={ui.showScore ? tags : new Map([...tags].map(([k, v]) => [k, v.split(" ")[0]!]))}
            onPlace={onPlace}
            onPlaceBoard={onPlaceBoard}
            onMove={(id, dx, dy) => moveObject(canvas.story, canvas.scene, id, { dx, dy })}
            selection={ui.selection}
            pointAt={ui.pointAt}
            onPick={pick}
            onErase={(ids) => canvas.history.erase(ids)}
            snap={snap}
            onText={(at) => {
              const text = window.prompt("Text")?.trim();
              if (text)
                onPlace({
                  kind: "text",
                  box: [at[0], at[1], Math.max(40, text.length * 10), 28],
                  color,
                  label: text.slice(0, 200),
                });
            }}
          />
          <ReplyDots events={events} objects={objects} />
        </Stage>

        {/* Everything else floats on top (D144); focus hides all but one button (D121). */}
        {!focus && (
          <div className="pointer-events-none absolute inset-0">
            <ProjectsMenu
              projects={projects.projects}
              current={projects.current}
              chat={projects.chat}
              connected={connected}
              saving={projects.saving}
              onOpen={(id) => void projects.open(id)}
              onNew={() => void projects.create()}
              onRename={projects.rename}
              onOpenChat={projects.openChat}
              onNewChat={projects.newChat}
              onOpenFile={(file) => void projects.openFile(file)}
            />

            <div className="absolute top-3 left-1/2 -translate-x-1/2">
              <Toolbar
                canvas={ui.canvas}
                canUndo={canvas.history.canUndo()}
                canRedo={canvas.history.canRedo()}
                onUndo={undo}
                onRedo={redo}
                onSave={() => void projects.saveNow()}
                onExport={projects.exportFile}
                onClear={clear}
              />
            </div>

            <div className="absolute top-3 right-3">
              <ModeButton state={mode} infos={infos} onPick={pickMode} />
            </div>

            {/* The right side bar: library, packs, grid, lines (D123 · D124). */}
            <div className="absolute top-16 right-3 flex items-start gap-2">
              {ui.side === "library" && (
                <LibraryPanel
                  onPlace={(item) => placeItem(item)}
                  onAddSelection={addSelection}
                  onGenerate={(prompt) => message(`Please draw a symbol for my library: ${prompt}`)}
                />
              )}
              {ui.side === "packs" && (
                <PacksPanel
                  packs={packRows}
                  available={!!session.http}
                  onToggle={(name, on) => {
                    session.registry.setEnabled(name, on);
                    setPackVersion((v) => v + 1);
                  }}
                  onInstall={(name) =>
                    void session.http
                      ?.installPack(name)
                      .then(() => session.http!.readPack(name))
                      .then((pack) => {
                        session.registry.load(pack);
                        refreshPacks();
                      })
                  }
                  onNew={() => message("Let's make a new pack together.")}
                  onWriteWithClaude={() =>
                    message("Please write a pack with me for what's on the canvas.")
                  }
                />
              )}
              <Surface className="flex w-[34px] flex-col items-center gap-1 px-[3px] py-1">
                <SideButton
                  label="Library"
                  on={ui.side === "library"}
                  onClick={() => ui.set({ side: ui.side === "library" ? undefined : "library" })}
                >
                  <BookOpen />
                </SideButton>
                <SideButton
                  label="Packs"
                  on={ui.side === "packs"}
                  onClick={() => ui.set({ side: ui.side === "packs" ? undefined : "packs" })}
                >
                  <Package />
                </SideButton>
                <span className="my-0.5 h-px w-4 bg-border" />
                <GridControl />
                <LinesControl />
              </Surface>
            </div>

            {/* Settings, zoom and the layout state, bottom left (D128 · D121). */}
            <Surface className="absolute bottom-3 left-3 flex items-center gap-0.5 p-1">
              <Tip label="Settings · ⌘," side="top">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Settings"
                  onClick={() => ui.set({ settingsOpen: true })}
                >
                  <SettingsIcon />
                </Button>
              </Tip>
              <DropdownMenu>
                <Tip label="Panels" side="top">
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Panels">
                      <PanelsTopLeft />
                    </Button>
                  </DropdownMenuTrigger>
                </Tip>
                <DropdownMenuContent side="top" align="start">
                  <DropdownMenuItem onSelect={() => ui.setLayout("open")}>
                    Open all <span className="ml-auto text-xs text-muted-foreground">\</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => ui.setLayout("collapsed")}>
                    Collapse all
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => ui.setLayout("focus")}>
                    Focus <span className="ml-auto text-xs text-muted-foreground">F</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="mx-1 h-5 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={() => zoomBy(1 / 1.25)}
              >
                <Minus />
              </Button>
              <button
                type="button"
                className="w-11 text-center text-xs tabular-nums text-muted-foreground"
                aria-label="Reset zoom"
                onClick={() => {
                  ui.set({ zoom: 1 });
                  setPan({ x: 0, y: 0 });
                }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={() => zoomBy(1.25)}
              >
                <Plus />
              </Button>
            </Surface>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
              {mode.seq !== undefined && noteGone !== mode.seq && (
                <ModeNote
                  state={mode}
                  previous={previous}
                  infos={infos}
                  onUndo={() => {
                    setMode(canvas.story, session.registry, {
                      mode: previous,
                      manual: false,
                      by: "user",
                      reason: "undo",
                    });
                  }}
                  onDismiss={() => setNoteGone(mode.seq)}
                />
              )}
              <ChatPanel
                events={events}
                chat={projects.chat}
                listening={claude.listening}
                connected={connected}
                onSend={(text, refs) => message(text, refs)}
                onAnswer={(seq, choice) => canvas.actor.answer(seq, choice)}
              />
            </div>

            <div className="absolute right-3 bottom-3">
              <EventsBox
                events={events}
                calls={claude.calls}
                listening={claude.listening}
                thinkingSince={claude.thinkingSince}
                now={now}
              />
            </div>

            {projects.error && (
              <Surface className="absolute top-16 left-1/2 max-w-md -translate-x-1/2 px-3 py-2 text-xs text-muted-foreground">
                {projects.error}
              </Surface>
            )}
          </div>
        )}
        {focus && (
          <div className="absolute right-3 bottom-3">
            <Tip label="Bring the panels back · F" side="left">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Bring the panels back"
                onClick={() => ui.setLayout("collapsed")}
              >
                <Maximize />
              </Button>
            </Tip>
          </div>
        )}
        <SettingsDialog
          behaviour={behaviour}
          onBehaviour={(next) => {
            setBehaviour(next);
            void session.http?.saveSettings(next).then(setBehaviour, () => undefined);
          }}
          connected={connected}
          version={VERSION}
        />
      </div>
    </TooltipProvider>
  );
}

function paintCanvas(canvas: "black" | "graphite" | "paper"): string {
  return { black: "#0f0f0f", graphite: "#1f1f1f", paper: "#fbfaf7" }[canvas];
}

function SideButton({
  label,
  on,
  onClick,
  children,
}: {
  label: string;
  on: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <Tip label={label} side="left">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-pressed={on}
        className={cn("size-[26px]", on && "bg-accent text-accent-foreground")}
        onClick={onClick}
      >
        {children}
      </Button>
    </Tip>
  );
}
