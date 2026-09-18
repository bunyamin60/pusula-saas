"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Target, Trophy } from "lucide-react";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import {
  BLOCK_COLOR_CLASS,
  BOARD_SIZE,
  LINE_POINTS,
  PLACE_POINTS,
  REWARD_THRESHOLDS,
  TRAY_SIZE,
  anyTrayPieceFits,
  blastPreview,
  boundingBox,
  dealTray,
  emptyBoard,
  findFullLines,
  lineClearKeys,
  pieceFits,
  placePiece,
  clearLines,
  type BlockColorId,
  type BlockShape,
  type Board,
} from "@/lib/blockShapes";
import { readCustomerProfile } from "@/lib/customerProfile";
import { submitQuizScore } from "@/lib/duelLeaderboard";
import { confirmStampVisit } from "@/lib/stampCard";

const FINGER_LIFT = 50;
const CLEAR_MS = 300;
const FLOAT_MS = 700;
const BOARD_MAX_PX = 340;
const SPARK_COUNT = 4;
const TRAY_GRID = 5;
/** Fixed tray preview cell — never flex-stretched (Tailwind size-4 = 16px). */
const TRAY_PREVIEW_CELL_PX = 16;
const TRAY_PREVIEW_GAP_PX = 4;

type CellMetrics = {
  size: number;
  colStride: number;
  rowStride: number;
  left: number;
  top: number;
  gap: number;
};

const DEFAULT_CELL: CellMetrics = {
  size: 36,
  colStride: 40,
  rowStride: 40,
  left: 0,
  top: 0,
  gap: 4,
};

function pieceGap(cell: number): number {
  return Math.max(2, Math.round(cell * 0.08));
}

type TraySlot = BlockShape | null;

type BlastSession = {
  board: Board;
  tray: TraySlot[];
  score: number;
  combo: number;
  over: boolean;
  claimed: number[];
};

type DragState = {
  pointerId: number;
  slot: number;
  shape: BlockShape;
  grabX: number;
  grabY: number;
  x: number;
  y: number;
  origin: { row: number; col: number } | null;
  valid: boolean;
};

type FloatText = {
  id: number;
  text: string;
  hot: boolean;
  x: number;
  y: number;
};

type Spark = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  tone: string;
};

function sessionKey(tenantId: string): string {
  return `blockblast_session_${tenantId}`;
}

function highKey(tenantId: string): string {
  return `blockblast_high_${tenantId}`;
}

const SPARK_TONES = [
  "bg-[var(--btn-primary)]",
  "bg-[var(--accent)]",
  "bg-[var(--text-headline)]",
  "bg-[var(--btn-text)]",
];

function comboCaption(
  copy: typeof tenantConfig.copy.blockblast,
  burst: number,
  lineCount: number,
  combo: number,
): string {
  const score = String(burst);
  if (combo > 1) {
    return copy.comboHot.replace("{n}", score).replace("{c}", String(combo));
  }
  if (lineCount >= 3) return copy.comboTriple.replace("{n}", score);
  if (lineCount === 2) return copy.comboDouble.replace("{n}", score);
  return copy.combo.replace("{n}", score);
}

function buzz(pattern: number[]) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // Vibration is optional.
  }
}

function themeConfettiColors(): string[] {
  if (typeof window === "undefined") return [];
  const styles = getComputedStyle(document.documentElement);
  return [
    styles.getPropertyValue("--btn-primary").trim(),
    styles.getPropertyValue("--text-headline").trim(),
    styles.getPropertyValue("--card-surface").trim(),
    styles.getPropertyValue("--accent").trim(),
  ].filter(Boolean);
}

function freshSession(): BlastSession {
  return {
    board: emptyBoard(),
    tray: dealTray(),
    score: 0,
    combo: 0,
    over: false,
    claimed: [],
  };
}

function parseClaimed(parsed: Partial<BlastSession> & { rewarded?: boolean }): number[] {
  if (Array.isArray(parsed.claimed)) {
    return parsed.claimed
      .map((value) => Number(value))
      .filter((value) => REWARD_THRESHOLDS.includes(value as (typeof REWARD_THRESHOLDS)[number]));
  }
  if (parsed.rewarded) return [];
  return [];
}

function readHigh(tenantId: string): number {
  if (typeof window === "undefined" || !tenantId) return 0;
  try {
    const raw = window.localStorage.getItem(highKey(tenantId));
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch {
    return 0;
  }
}

function writeHigh(tenantId: string, value: number): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    window.localStorage.setItem(highKey(tenantId), String(value));
  } catch {
    // ignore
  }
}

function readSession(tenantId: string): BlastSession {
  const fallback = freshSession();
  if (typeof window === "undefined" || !tenantId) return fallback;
  try {
    const raw = window.localStorage.getItem(sessionKey(tenantId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BlastSession>;
    const board = Array.isArray(parsed.board) ? parsed.board : fallback.board;
    if (board.length !== BOARD_SIZE) return fallback;
    const tray = Array.isArray(parsed.tray)
      ? parsed.tray.slice(0, TRAY_SIZE).map((slot) =>
          slot && Array.isArray(slot.cells) ? (slot as BlockShape) : null,
        )
      : fallback.tray;
    while (tray.length < TRAY_SIZE) tray.push(null);
    return {
      board: board.map((row) =>
        Array.isArray(row)
          ? row.map((cell) => (cell ? Number(cell) : 0) as Board[number][number])
          : Array.from({ length: BOARD_SIZE }, () => 0 as Board[number][number]),
      ),
      tray,
      score: Math.max(0, Number(parsed.score) || 0),
      combo: Math.max(0, Number(parsed.combo) || 0),
      over: Boolean(parsed.over),
      claimed: parseClaimed(parsed),
    };
  } catch {
    return fallback;
  }
}

function writeSession(tenantId: string, session: BlastSession): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    window.localStorage.setItem(sessionKey(tenantId), JSON.stringify(session));
  } catch {
    // ignore
  }
}

function scoreNickname(): string {
  const profile = readCustomerProfile();
  if (profile?.name) return profile.name;
  return tenantConfig.copy.duel.guestPlayer.replace(
    "{table}",
    tenantConfig.brand.tableName,
  );
}

export function BlockBlastGame({
  onBack,
  onReset,
}: {
  onBack: () => void;
  onReset: () => void;
}) {
  const copy = tenantConfig.copy.blockblast;
  const { tenantId, player } = useDuel();
  const [session, setSession] = useState<BlastSession | null>(null);
  const [high, setHigh] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [clearing, setClearing] = useState<string[]>([]);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [impact, setImpact] = useState<"pop" | "shake" | null>(null);
  const [cell, setCell] = useState<CellMetrics>(DEFAULT_CELL);
  const cellRef = useRef(cell);
  cellRef.current = cell;
  const boardRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [boardPx, setBoardPx] = useState(280);
  const sessionRef = useRef<BlastSession | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const busyRef = useRef(false);
  const floatId = useRef(0);
  const sparkId = useRef(0);
  const claimedRef = useRef<number[]>([]);
  const savedOverRef = useRef(false);
  const unbindDragRef = useRef<() => void>(() => undefined);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  sessionRef.current = session;

  const persist = useCallback(
    (next: BlastSession) => {
      sessionRef.current = next;
      writeSession(tenantId, next);
      setSession(next);
      if (next.score > readHigh(tenantId)) {
        writeHigh(tenantId, next.score);
        setHigh(next.score);
      }
    },
    [tenantId],
  );

  const measure = useCallback(() => {
    const origin = boardRef.current?.querySelector<HTMLElement>("[data-cell='0-0']");
    const right = boardRef.current?.querySelector<HTMLElement>("[data-cell='0-1']");
    const below = boardRef.current?.querySelector<HTMLElement>("[data-cell='1-0']");
    if (!origin) return;
    const a = origin.getBoundingClientRect();
    const b = right?.getBoundingClientRect();
    const c = below?.getBoundingClientRect();
    const next: CellMetrics = {
      size: a.width,
      colStride: b ? b.left - a.left : a.width,
      rowStride: c ? c.top - a.top : a.height,
      left: a.left,
      top: a.top,
      gap: b ? Math.max(0, b.left - a.right) : 0,
    };
    cellRef.current = next;
    setCell(next);
  }, []);

  const measureStage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const side = Math.floor(
      Math.max(160, Math.min(rect.width, rect.height, BOARD_MAX_PX)),
    );
    setBoardPx(side);
  }, []);

  useEffect(() => {
    const next = readSession(tenantId);
    setSession(next);
    setHigh(Math.max(readHigh(tenantId), next.score));
    claimedRef.current = next.claimed;
    savedOverRef.current = next.over;
  }, [tenantId]);

  useEffect(() => {
    measureStage();
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      measureStage();
      requestAnimationFrame(measure);
    });
    observer.observe(stage);
    window.addEventListener("resize", measureStage);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureStage);
    };
  }, [measure, measureStage, session?.over]);

  useEffect(() => {
    measure();
    const node = boardRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, boardPx, session?.over]);

  useEffect(() => {
    const root = trayRef.current;
    if (!root) return;
    const down = (event: PointerEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
        "[data-tray-slot]",
      );
      if (!button || !root.contains(button)) return;
      const slot = Number(button.dataset.traySlot);
      const shape = sessionRef.current?.tray[slot];
      if (!shape || Number.isNaN(slot)) return;
      startDrag(event, slot, shape, button);
    };
    root.addEventListener("pointerdown", down);
    return () => root.removeEventListener("pointerdown", down);
  }, [session?.tray]);

  const spawnFloat = useCallback((text: string, hot: boolean, x: number, y: number) => {
    const id = (floatId.current += 1);
    setFloats((current) => [...current, { id, text, hot, x, y }]);
    window.setTimeout(() => {
      setFloats((current) => current.filter((item) => item.id !== id));
    }, FLOAT_MS);
  }, []);

  function cellAnchor(key: string) {
    const board = boardRef.current;
    const node = board?.querySelector<HTMLElement>(`[data-cell='${key}']`);
    if (!board || !node) return { x: 50, y: 50 };
    const a = board.getBoundingClientRect();
    const b = node.getBoundingClientRect();
    return {
      x: ((b.left + b.width / 2 - a.left) / a.width) * 100,
      y: ((b.top + b.height / 2 - a.top) / a.height) * 100,
    };
  }

  function burstFx(keys: string[], lineCount: number, combo: number) {
    const anchors = keys.map((key) => cellAnchor(key));
    const mid = {
      x: anchors.reduce((sum, item) => sum + item.x, 0) / Math.max(anchors.length, 1),
      y: anchors.reduce((sum, item) => sum + item.y, 0) / Math.max(anchors.length, 1),
    };
    const nextSparks: Spark[] = keys.flatMap((key, index) => {
      const origin = anchors[index] ?? mid;
      return Array.from({ length: SPARK_COUNT }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 28;
        return {
          id: (sparkId.current += 1),
          x: origin.x,
          y: origin.y,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          tone: SPARK_TONES[Math.floor(Math.random() * SPARK_TONES.length)] ?? SPARK_TONES[0]!,
        };
      });
    });
    setSparks(nextSparks);
    window.setTimeout(() => {
      setSparks((current) => current.filter((item) => !nextSparks.some((spark) => spark.id === item.id)));
    }, CLEAR_MS);
    setImpact(lineCount > 1 || combo > 1 ? "shake" : "pop");
    window.setTimeout(() => setImpact(null), 180);
    buzz([30, 20, 40]);
    return mid;
  }

  useEffect(() => {
    if (!session) return;
    const pending = REWARD_THRESHOLDS.filter(
      (mark) => session.score >= mark && !claimedRef.current.includes(mark),
    );
    if (pending.length === 0) return;
    claimedRef.current = [...claimedRef.current, ...pending];
    persist({ ...session, claimed: claimedRef.current });
    setToast(copy.rewardGoal);
    window.setTimeout(() => setToast(null), 2800);
    void confetti({
      particleCount: 140,
      spread: 76,
      startVelocity: 36,
      origin: { y: 0.42 },
      colors: themeConfettiColors(),
    });
    void (async () => {
      for (const _mark of pending) {
        await confirmStampVisit({
          tenantId,
          clientId: player.clientId,
          tableId: tenantConfig.brand.tableName,
        });
      }
    })();
  }, [copy.rewardGoal, persist, player.clientId, session, tenantId]);

  useEffect(() => {
    if (!session?.over || savedOverRef.current) return;
    savedOverRef.current = true;
    void submitQuizScore({
      tenantId,
      clientId: player.clientId,
      nickname: scoreNickname(),
      avatar: player.avatar,
      score: session.score,
      gameType: "blockblast",
    });
  }, [player.avatar, player.clientId, session, tenantId]);

  function readCellMetrics(): CellMetrics {
    const origin = boardRef.current?.querySelector<HTMLElement>("[data-cell='0-0']");
    const right = boardRef.current?.querySelector<HTMLElement>("[data-cell='0-1']");
    const below = boardRef.current?.querySelector<HTMLElement>("[data-cell='1-0']");
    if (!origin) return cellRef.current;
    const a = origin.getBoundingClientRect();
    const b = right?.getBoundingClientRect();
    const c = below?.getBoundingClientRect();
    const metrics: CellMetrics = {
      size: a.width,
      colStride: b ? b.left - a.left : a.width,
      rowStride: c ? c.top - a.top : a.height,
      left: a.left,
      top: a.top,
      gap: b ? Math.max(0, b.left - a.right) : 0,
    };
    cellRef.current = metrics;
    return metrics;
  }

  /** Map floating piece top-left (after finger lift) onto board cell origin. */
  function originFromPoint(
    clientX: number,
    clientY: number,
    grabX: number,
    grabY: number,
  ) {
    const metrics = readCellMetrics();
    // Ghost is drawn at (clientX - grabX, clientY - grabY - FINGER_LIFT).
    const pieceLeft = clientX - grabX;
    const pieceTop = clientY - grabY - FINGER_LIFT;
    const col = Math.round((pieceLeft - metrics.left) / metrics.colStride);
    const row = Math.round((pieceTop - metrics.top) / metrics.rowStride);
    return { row, col };
  }

  function unbindWindowDrag() {
    unbindDragRef.current();
    unbindDragRef.current = () => undefined;
  }

  function finishPlace(nextBoard: Board, nextTray: TraySlot[], gained: number, combo: number) {
    let tray = nextTray;
    if (tray.every((slot) => slot == null)) tray = dealTray();
    const over = !anyTrayPieceFits(nextBoard, tray);
    persist({
      board: nextBoard,
      tray,
      score: gained,
      combo,
      over,
      claimed: sessionRef.current?.claimed ?? [],
    });
  }

  function previewOrigin(
    clientX: number,
    clientY: number,
    grabX: number,
    grabY: number,
    cells: BlockShape["cells"],
  ) {
    const origin = originFromPoint(clientX, clientY, grabX, grabY);
    return {
      origin,
      valid: pieceFits(
        sessionRef.current?.board ?? emptyBoard(),
        cells,
        origin.row,
        origin.col,
      ),
    };
  }

  function dropPiece(state: DragState) {
    const current = sessionRef.current;
    if (!current || current.over || busyRef.current) return;
    const snapped = previewOrigin(
      state.x,
      state.y,
      state.grabX,
      state.grabY,
      state.shape.cells,
    );
    if (!snapped.valid) {
      dragRef.current = null;
      setDrag(null);
      return;
    }
    const placed = placePiece(
      current.board,
      state.shape.cells,
      snapped.origin.row,
      snapped.origin.col,
      state.shape.colorId,
    );
    const tray = current.tray.map((slot, index) => (index === state.slot ? null : slot));
    const lines = findFullLines(placed);
    const lineCount = lines.rows.length + lines.cols.length;
    const placeScore = state.shape.cells.length * PLACE_POINTS;
    dragRef.current = null;
    setDrag(null);

    if (lineCount === 0) {
      finishPlace(placed, tray, current.score + placeScore, 0);
      return;
    }

    const combo = current.combo + 1;
    const burst = lineCount * LINE_POINTS * combo;
    const keys = lineClearKeys(lines.rows, lines.cols);
    busyRef.current = true;
    setClearing(keys);
    const mid = burstFx(keys, lineCount, combo);
    spawnFloat(comboCaption(copy, burst, lineCount, combo), combo > 1 || lineCount > 1, mid.x, mid.y);
    persist({
      ...current,
      board: placed,
      tray,
      score: current.score + placeScore + burst,
      combo,
      over: false,
      claimed: current.claimed,
    });
    window.setTimeout(() => {
      const latest = sessionRef.current;
      if (!latest) {
        busyRef.current = false;
        setClearing([]);
        return;
      }
      const cleared = clearLines(placed, lines.rows, lines.cols);
      setClearing([]);
      busyRef.current = false;
      finishPlace(cleared, tray, latest.score, combo);
    }, CLEAR_MS);
  }

  function startDrag(
    event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY" | "preventDefault">,
    slot: number,
    shape: BlockShape,
    target: HTMLElement,
  ) {
    if (sessionRef.current?.over || busyRef.current) return;
    if (dragRef.current?.pointerId === event.pointerId) return;
    event.preventDefault();
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Untrusted or already-captured pointers still drag via window listeners.
    }
    const metrics = readCellMetrics();
    const box = boundingBox(shape.cells);
    const gap = pieceGap(metrics.size);
    const grabX = (box.cols * metrics.size + Math.max(0, box.cols - 1) * gap) / 2;
    const grabY = (box.rows * metrics.size + Math.max(0, box.rows - 1) * gap) / 2;
    const snapped = previewOrigin(
      event.clientX,
      event.clientY,
      grabX,
      grabY,
      shape.cells,
    );
    const next: DragState = {
      pointerId: event.pointerId,
      slot,
      shape,
      grabX,
      grabY,
      x: event.clientX,
      y: event.clientY,
      origin: snapped.origin,
      valid: snapped.valid,
    };
    dragRef.current = next;
    setDrag(next);
    bindWindowDrag(next.pointerId);
  }

  function onPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    slot: number,
    shape: BlockShape,
  ) {
    startDrag(event, slot, shape, event.currentTarget);
  }

  function trackPointer(event: {
    pointerId: number;
    clientX: number;
    clientY: number;
  }) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return current;
    const snapped = previewOrigin(
      event.clientX,
      event.clientY,
      current.grabX,
      current.grabY,
      current.shape.cells,
    );
    const next = {
      ...current,
      x: event.clientX,
      y: event.clientY,
      origin: snapped.origin,
      valid: snapped.valid,
    };
    dragRef.current = next;
    setDrag(next);
    return next;
  }

  function endPointer(
    event: { pointerId: number; clientX: number; clientY: number },
    target?: EventTarget | null,
  ) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    unbindWindowDrag();
    const next = trackPointer(event) ?? current;
    dragRef.current = null;
    if (target && "releasePointerCapture" in target) {
      try {
        (target as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }
    }
    dropPiece(next);
  }

  function bindWindowDrag(pointerId: number) {
    unbindWindowDrag();
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      trackPointer(event);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      endPointer(event, event.target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    unbindDragRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    trackPointer(event);
  }

  function onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    endPointer(event, event.currentTarget);
  }

  if (!session) {
    return <div className="flex flex-1 items-center justify-center" />;
  }

  const hover =
    drag?.valid && drag.origin
      ? blastPreview(
          session.board,
          drag.shape.cells,
          drag.origin.row,
          drag.origin.col,
          drag.shape.colorId,
        )
      : { piece: [] as string[], blast: [] as string[] };
  const goal = REWARD_THRESHOLDS[0] ?? 10000;
  const goalFill = `${Math.min(100, (session.score / goal) * 100)}%`;

  return (
    <section
      className={`relative flex h-full max-h-full min-h-0 flex-1 flex-col justify-between overflow-hidden p-2 select-none sm:p-3 ${
        drag ? "touch-none" : ""
      }`}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] p-2 shadow-sm">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-body)]">
              {copy.score}
            </p>
            <p className="font-sans text-xl font-black tabular-nums tracking-tight text-[var(--btn-primary)]">
              {session.score}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] p-2 shadow-sm">
            <p className="flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-body)]">
              <Trophy className="size-3 text-[var(--btn-primary)]" aria-hidden />
              {copy.best}
            </p>
            <p className="font-sans text-xl font-black tabular-nums tracking-tight text-[var(--text-headline)]">
              {high}
            </p>
          </div>
        </div>

        <div className="mt-2 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] p-2">
          <p className="flex items-center gap-1.5 font-sans text-[10px] font-bold leading-snug text-[var(--text-headline)]">
            <Target className="size-3.5 shrink-0 text-[var(--btn-primary)]" aria-hidden />
            <span className="min-w-0 truncate">{copy.goalLabel}</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-headline)_12%,transparent)]">
            <div
              className="h-1.5 rounded-full bg-[var(--btn-primary)]"
              style={{ width: goalFill }}
            />
          </div>
        </div>

        {toast ? (
          <p className="mt-2 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--btn-primary)] px-3 py-1.5 text-center font-sans text-[11px] font-black text-[var(--btn-text)] shadow-sm">
            {toast}
          </p>
        ) : null}

        <div
          ref={stageRef}
          className="flex min-h-0 flex-1 items-center justify-center py-2"
        >
          <div
            ref={boardRef}
            className={`relative mx-auto grid aspect-square w-full max-w-[340px] grid-cols-8 gap-0.5 overflow-hidden rounded-2xl border-[3px] border-[var(--border)] bg-[var(--card-surface)] p-1.5 shadow-lg sm:gap-1 sm:rounded-3xl sm:border-4 sm:p-2 ${
              impact === "shake"
                ? "blast-board-shake"
                : impact === "pop"
                  ? "blast-board-pop"
                  : ""
            }`}
            style={{ width: boardPx, height: boardPx, maxWidth: BOARD_MAX_PX }}
          >
            {session.board.map((row, rowIndex) =>
              row.map((value, colIndex) => {
                const key = `${rowIndex}-${colIndex}`;
                const previewHere = hover.piece.includes(key);
                const blasting = hover.blast.includes(key);
                const popping = clearing.includes(key);
                return (
                  <div
                    key={key}
                    data-cell={key}
                    className={`aspect-square min-h-0 min-w-0 rounded-md border border-[color-mix(in_srgb,var(--text-headline)_10%,transparent)] bg-[color-mix(in_srgb,var(--text-headline)_8%,transparent)] ${
                      popping ? "relative z-20 overflow-visible" : "transition-none"
                    }`}
                  >
                    {value ? (
                      <span
                        className={`block h-full w-full rounded-md ${BLOCK_COLOR_CLASS[value as BlockColorId]} ${
                          popping
                            ? "blast-pop"
                            : blasting
                              ? "brightness-125 ring-2 ring-[var(--logo-well)]/60 transition-none"
                              : "transition-none"
                        }`}
                      />
                    ) : previewHere ? (
                      <span className="block h-full w-full rounded-md border-2 border-[var(--logo-well)]/60 bg-[var(--logo-well)]/30 transition-none" />
                    ) : null}
                  </div>
                );
              }),
            )}
            {sparks.map((spark) => (
              <span
                key={spark.id}
                aria-hidden
                className={`pointer-events-none absolute z-30 size-1.5 rounded-full ${spark.tone} blast-spark`}
                style={{
                  left: `${spark.x}%`,
                  top: `${spark.y}%`,
                  ["--dx" as string]: `${spark.dx}px`,
                  ["--dy" as string]: `${spark.dy}px`,
                }}
              />
            ))}
            {floats.map((item) => (
              <p
                key={item.id}
                className={`pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[var(--btn-primary)] px-2.5 py-1 font-sans text-sm font-black tracking-wide text-[var(--btn-text)] shadow-lg blast-float ${
                  item.hot ? "ring-2 ring-[var(--logo-well)]/70" : ""
                }`}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
              >
                {item.text}
              </p>
            ))}
          </div>
        </div>

        <div
          ref={trayRef}
          className="mb-2 grid shrink-0 grid-cols-3 gap-2"
        >
          {session.tray.map((piece, slot) => (
            <div
              key={slot}
              className="flex h-24 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] sm:h-28"
            >
              {piece ? (
                <button
                  type="button"
                  data-tray-slot={slot}
                  aria-label={copy.dragHint}
                  onPointerDown={(event) => onPointerDown(event, slot, piece)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className={`flex size-full items-center justify-center touch-none active:scale-95 ${
                    drag?.slot === slot ? "opacity-0" : ""
                  }`}
                  style={{ touchAction: "none" }}
                >
                  <TrayPiecePreview shape={piece} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {drag ? (
        <div
          className="pointer-events-none fixed z-40"
          style={{
            left: drag.x - drag.grabX,
            top: drag.y - drag.grabY - FINGER_LIFT,
            transform: "scale(1.08)",
            touchAction: "none",
          }}
        >
          <PieceGrid shape={drag.shape} cell={cell.size} />
        </div>
      ) : null}

      {session.over ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--bg-canvas)]/80 px-4">
          <div className="w-full max-w-xs rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] p-6 text-center shadow-2xl">
            <h2 className="font-sans text-xl font-black tracking-tight text-[var(--text-headline)]">
              {copy.overTitle}
            </h2>
            <p className="mt-2 font-sans text-sm font-medium text-[var(--text-body)]">
              {copy.overLead}
            </p>
            <p className="mt-4 font-sans text-3xl font-black tabular-nums text-[var(--btn-primary)]">
              {session.score}
            </p>
            {session.claimed.length > 0 ? (
              <p className="mt-2 font-sans text-xs font-bold text-[var(--text-headline)]">
                {copy.rewardLead}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={onReset}
                className="min-h-12 flex-1 rounded-2xl bg-[var(--btn-primary)] px-6 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg active:scale-95"
              >
                {copy.overCta}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="min-h-12 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] px-6 py-3.5 font-sans text-sm font-bold text-[var(--text-body)] active:scale-95"
              >
                {copy.exitCta}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <style>{`
        @keyframes blastPop {
          0% { transform: scale(1); filter: brightness(1); }
          26% { transform: scale(1.18); filter: brightness(2.2); box-shadow: 0 0 20px rgba(255,255,255,0.9); }
          100% { transform: scale(0) rotate(45deg); opacity: 0; }
        }
        @keyframes floatScore {
          0% { opacity: 0; transform: translate(-50%, -50%) translateY(10px) scale(0.8); }
          25% { opacity: 1; transform: translate(-50%, -50%) translateY(0) scale(1.15); }
          100% { opacity: 0; transform: translate(-50%, -50%) translateY(-35px) scale(0.9); }
        }
        @keyframes blastSpark {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.15); }
        }
        @keyframes blastBoardPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.015); }
          100% { transform: scale(1); }
        }
        @keyframes blastBoardShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        .blast-pop {
          animation: blastPop 300ms ease-out forwards;
          z-index: 20;
        }
        .blast-float {
          animation: floatScore 700ms ease-out forwards;
        }
        .blast-spark {
          animation: blastSpark 250ms ease-out forwards;
        }
        .blast-board-pop {
          animation: blastBoardPop 150ms ease-out;
        }
        .blast-board-shake {
          animation: blastBoardShake 180ms ease-out;
        }
      `}</style>
    </section>
  );
}

function TrayPiecePreview({ shape }: { shape: BlockShape }) {
  const box = boundingBox(shape.cells);
  const offsetR = Math.floor((TRAY_GRID - box.rows) / 2);
  const offsetC = Math.floor((TRAY_GRID - box.cols) / 2);
  const side =
    TRAY_GRID * TRAY_PREVIEW_CELL_PX + (TRAY_GRID - 1) * TRAY_PREVIEW_GAP_PX;

  return (
    <div
      className="grid shrink-0"
      aria-hidden
      style={{
        width: side,
        height: side,
        gridTemplateColumns: `repeat(${TRAY_GRID}, ${TRAY_PREVIEW_CELL_PX}px)`,
        gridTemplateRows: `repeat(${TRAY_GRID}, ${TRAY_PREVIEW_CELL_PX}px)`,
        gap: TRAY_PREVIEW_GAP_PX,
      }}
    >
      {Array.from({ length: TRAY_GRID * TRAY_GRID }, (_, index) => {
        const row = Math.floor(index / TRAY_GRID);
        const col = index % TRAY_GRID;
        const filled = shape.cells.some(
          (cell) => cell.r + offsetR === row && cell.c + offsetC === col,
        );
        return (
          <span
            key={`${row}-${col}`}
            className={`block size-4 shrink-0 rounded-md ${
              filled ? shape.colorClass : "opacity-0"
            }`}
          />
        );
      })}
    </div>
  );
}

/** Board-scale piece used while dragging (matches 8x8 cell size). */
function PieceGrid({ shape, cell }: { shape: BlockShape; cell: number }) {
  const box = boundingBox(shape.cells);
  const gap = pieceGap(cell);
  return (
    <div
      className="grid shrink-0"
      style={{
        gridTemplateColumns: `repeat(${box.cols}, ${cell}px)`,
        gridTemplateRows: `repeat(${box.rows}, ${cell}px)`,
        gap,
      }}
    >
      {Array.from({ length: box.rows * box.cols }, (_, index) => {
        const row = Math.floor(index / box.cols);
        const col = index % box.cols;
        const filled = shape.cells.some((item) => item.r === row && item.c === col);
        return (
          <span
            key={`${row}-${col}`}
            className={`block shrink-0 rounded-md ${filled ? shape.colorClass : "opacity-0"}`}
            style={{ width: cell, height: cell }}
          />
        );
      })}
    </div>
  );
}
