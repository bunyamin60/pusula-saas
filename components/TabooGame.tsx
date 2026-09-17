"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import confetti from "canvas-confetti";
import { animate, motion, useMotionValue } from "framer-motion";
import { Eye, Smartphone } from "lucide-react";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { clearArcadeGameSession } from "@/lib/arcadeSession";
import { confirmStampVisit } from "@/lib/stampCard";
import { TABOO_CARDS, shuffleTabooOrder, type TabooCard } from "@/lib/tabooWords";

const ROUND_MS = 60_000;
const TABLE_WIN = 6;
const TEAM_TARGET = 15;
const PASS_MAX = 3;
const SWIPE_THRESHOLD = 80;
const COUNTDOWN_MS = 700;

type GameMode = "teams" | "table";
type GameState = "setup" | "ready" | "playing" | "round_over" | "game_over";
type TeamId = "a" | "b";
type SwipeKind = "correct" | "burn" | "pass";
type StampHint = { kind: SwipeKind; opacity: number } | null;

type TabooSession = {
  mode: GameMode;
  state: GameState;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  activeTeam: TeamId;
  deck: number[];
  cursor: number;
  roundCorrect: number;
  roundTabu: number;
  passUsed: number;
  passLeft: number;
  endsAt: number | null;
  rewarded: boolean;
  winner: TeamId | "table" | null;
};

function storageKey(tenantId: string): string {
  return `taboo_session_${tenantId}`;
}

function themeConfettiColors(): string[] {
  if (typeof window === "undefined") return [];
  const styles = getComputedStyle(document.documentElement);
  return [
    styles.getPropertyValue("--btn-primary").trim(),
    styles.getPropertyValue("--text-headline").trim(),
    styles.getPropertyValue("--card-surface").trim(),
    styles.getPropertyValue("--text-body").trim(),
  ].filter(Boolean);
}

function remainingSeconds(endsAt: number | null): number {
  if (endsAt == null) return 60;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hintFromOffset(dx: number, dy: number): StampHint {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < 12 && absY < 12) return null;
  if (absY > absX && dy > 0) {
    return { kind: "pass", opacity: clamp01(absY / SWIPE_THRESHOLD) };
  }
  if (dx > 0) return { kind: "correct", opacity: clamp01(absX / SWIPE_THRESHOLD) };
  return { kind: "burn", opacity: clamp01(absX / SWIPE_THRESHOLD) };
}

function resolveSwipe(dx: number, dy: number): SwipeKind | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absY >= absX && dy > SWIPE_THRESHOLD) return "pass";
  if (absX >= absY && dx > SWIPE_THRESHOLD) return "correct";
  if (absX >= absY && dx < -SWIPE_THRESHOLD) return "burn";
  return null;
}

function whistle(): void {
  try {
    navigator.vibrate?.(180);
  } catch {
    // ignore
  }
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
    window.setTimeout(() => void ctx.close(), 400);
  } catch {
    // ignore
  }
}

function blankSession(copy: typeof tenantConfig.copy.taboo): TabooSession {
  return {
    mode: "table",
    state: "setup",
    teamAName: copy.teamADefault,
    teamBName: copy.teamBDefault,
    teamAScore: 0,
    teamBScore: 0,
    activeTeam: "a",
    deck: shuffleTabooOrder(),
    cursor: 0,
    roundCorrect: 0,
    roundTabu: 0,
    passUsed: 0,
    passLeft: PASS_MAX,
    endsAt: null,
    rewarded: false,
    winner: null,
  };
}

function readSession(tenantId: string, fallback: TabooSession): TabooSession {
  if (typeof window === "undefined" || !tenantId) return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<TabooSession>;
    if (parsed.state && parsed.state !== "setup") {
      clearArcadeGameSession("taboo", tenantId);
      return {
        ...fallback,
        mode: parsed.mode === "teams" ? "teams" : "table",
        teamAName: String(parsed.teamAName || fallback.teamAName),
        teamBName: String(parsed.teamBName || fallback.teamBName),
        state: "setup",
      };
    }
    const state = (
      ["setup", "ready", "playing", "round_over"] as GameState[]
    ).includes(parsed.state as GameState)
      ? (parsed.state as GameState)
      : "setup";
    const endsAt = typeof parsed.endsAt === "number" ? parsed.endsAt : null;
    const next: TabooSession = {
      ...fallback,
      ...parsed,
      mode: parsed.mode === "teams" ? "teams" : "table",
      state: state === "playing" && (endsAt == null || endsAt <= Date.now()) ? "round_over" : state,
      activeTeam: parsed.activeTeam === "b" ? "b" : "a",
      deck: Array.isArray(parsed.deck) && parsed.deck.length ? parsed.deck : fallback.deck,
      cursor: Math.max(0, Number(parsed.cursor) || 0),
      teamAScore: Math.max(0, Number(parsed.teamAScore) || 0),
      teamBScore: Math.max(0, Number(parsed.teamBScore) || 0),
      roundCorrect: Math.max(0, Number(parsed.roundCorrect) || 0),
      roundTabu: Math.max(0, Number(parsed.roundTabu) || 0),
      passUsed: Math.max(0, Number(parsed.passUsed) || 0),
      passLeft: Math.max(0, Math.min(PASS_MAX, Number(parsed.passLeft) ?? PASS_MAX)),
      endsAt,
      rewarded: Boolean(parsed.rewarded),
      winner: parsed.winner === "a" || parsed.winner === "b" || parsed.winner === "table"
        ? parsed.winner
        : null,
    };
    return next;
  } catch {
    return fallback;
  }
}

function writeSession(tenantId: string, session: TabooSession): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    if (session.state === "setup") {
      window.localStorage.setItem(storageKey(tenantId), JSON.stringify(session));
      return;
    }
    if (session.state === "game_over") {
      clearArcadeGameSession("taboo", tenantId);
    }
    // Mid-match states stay in memory so leaving the page returns to setup.
  } catch {
    // Private mode may block storage.
  }
}

function teamName(session: TabooSession, id: TeamId): string {
  return id === "a" ? session.teamAName : session.teamBName;
}

function nextTeam(id: TeamId): TeamId {
  return id === "a" ? "b" : "a";
}

export function TabooGame() {
  const copy = tenantConfig.copy.taboo;
  const { tenantId, player } = useDuel();
  const [session, setSession] = useState<TabooSession | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [gateBeat, setGateBeat] = useState<string | null>(null);
  const [lifting, setLifting] = useState(false);
  const rewardedRef = useRef(false);
  const sessionRef = useRef<TabooSession | null>(null);
  const swipeApi = useRef<{ play: (kind: SwipeKind) => void } | null>(null);
  sessionRef.current = session;

  const persist = useCallback(
    (next: TabooSession) => {
      sessionRef.current = next;
      writeSession(tenantId, next);
      setSession(next);
    },
    [tenantId],
  );

  useEffect(() => {
    const next = readSession(tenantId, blankSession(copy));
    setSession(next);
    setSeconds(remainingSeconds(next.endsAt));
  }, [copy, tenantId]);

  useEffect(() => {
    const tick = () => {
      const current = sessionRef.current;
      if (!current || current.state !== "playing") return;
      const left = remainingSeconds(current.endsAt);
      setSeconds(left);
      if (left > 0) return;
      whistle();
      persist(finishRound(current));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [persist]);

  const wonFinal = session?.state === "game_over";

  useEffect(() => {
    if (!wonFinal) return;
    void confetti({
      particleCount: 160,
      spread: 76,
      startVelocity: 38,
      origin: { y: 0.38 },
      colors: themeConfettiColors(),
    });
  }, [wonFinal]);

  useEffect(() => {
    if (!session || session.state !== "game_over" || session.rewarded || rewardedRef.current) {
      return;
    }
    rewardedRef.current = true;
    void confirmStampVisit({
      tenantId,
      clientId: player.clientId,
      tableId: tenantConfig.brand.tableName,
    }).then(() => {
      const current = sessionRef.current;
      if (!current) return;
      persist({ ...current, rewarded: true });
    });
  }, [persist, player.clientId, session, tenantId]);

  const card = useMemo(() => {
    if (!session) return null;
    const index = session.deck[session.cursor % session.deck.length] ?? 0;
    return TABOO_CARDS[index] ?? TABOO_CARDS[0];
  }, [session]);

  function patchRound(update: Partial<TabooSession>) {
    const current = sessionRef.current;
    if (!current || current.state !== "playing") return;
    const nextCursor = (update.cursor ?? current.cursor) + (update.cursor == null ? 1 : 0);
    persist({
      ...current,
      ...update,
      cursor:
        update.cursor != null
          ? update.cursor
          : current.cursor + 1,
      deck:
        nextCursor % current.deck.length === 0 && nextCursor > 0
          ? shuffleTabooOrder()
          : current.deck,
    });
    setLifting(false);
  }

  function applySwipe(kind: SwipeKind) {
    const current = sessionRef.current;
    if (!current || current.state !== "playing") return;
    if (kind === "correct") {
      patchRound({ roundCorrect: current.roundCorrect + 1 });
      return;
    }
    if (kind === "burn") {
      patchRound({ roundTabu: current.roundTabu + 1 });
      return;
    }
    if (current.passLeft <= 0) return;
    patchRound({
      passLeft: current.passLeft - 1,
      passUsed: current.passUsed + 1,
    });
  }

  function resetMatch() {
    rewardedRef.current = false;
    setGateBeat(null);
    setLifting(false);
    clearArcadeGameSession("taboo", tenantId);
    const blank = blankSession(copy);
    sessionRef.current = blank;
    setSession(blank);
    setSeconds(60);
  }

  function startMatch() {
    const current = sessionRef.current;
    if (!current) return;
    persist({
      ...current,
      state: "ready",
      teamAName: current.teamAName.trim() || copy.teamADefault,
      teamBName: current.teamBName.trim() || copy.teamBDefault,
      teamAScore: 0,
      teamBScore: 0,
      activeTeam: "a",
      deck: shuffleTabooOrder(),
      cursor: 0,
      roundCorrect: 0,
      roundTabu: 0,
      passUsed: 0,
      passLeft: PASS_MAX,
      endsAt: null,
      rewarded: false,
      winner: null,
    });
    rewardedRef.current = false;
  }

  function beginCountdown() {
    setGateBeat("3");
  }

  useEffect(() => {
    if (!gateBeat) return;
    const beats = ["3", "2", "1", tenantConfig.copy.landing.gameShell.countdownGo];
    const index = beats.indexOf(gateBeat);
    const timer = window.setTimeout(() => {
      if (index >= beats.length - 1) {
        setGateBeat(null);
        const current = sessionRef.current;
        if (!current) return;
        persist({
          ...current,
          state: "playing",
          roundCorrect: 0,
          roundTabu: 0,
          passUsed: 0,
          passLeft: PASS_MAX,
          endsAt: Date.now() + ROUND_MS,
        });
        setSeconds(60);
        return;
      }
      setGateBeat(beats[index + 1] ?? null);
    }, COUNTDOWN_MS);
    return () => window.clearTimeout(timer);
  }, [gateBeat, persist]);

  function handoff() {
    const current = sessionRef.current;
    if (!current) return;
    persist({
      ...current,
      state: "ready",
      activeTeam: current.mode === "teams" ? nextTeam(current.activeTeam) : current.activeTeam,
      deck: shuffleTabooOrder(),
      cursor: 0,
      roundCorrect: 0,
      roundTabu: 0,
      passUsed: 0,
      passLeft: PASS_MAX,
      endsAt: null,
    });
  }

  function backToLobby() {
    resetMatch();
  }

  if (!session) {
    return <div className="flex flex-1 items-center justify-center" />;
  }

  if (session.state === "setup") {
    return (
      <SetupScreen
        session={session}
        onMode={(mode) => persist({ ...session, mode })}
        onTeamA={(teamAName) => persist({ ...session, teamAName })}
        onTeamB={(teamBName) => persist({ ...session, teamBName })}
        onStart={startMatch}
      />
    );
  }

  if (session.state === "ready" || gateBeat) {
    return (
      <ReadyScreen
        session={session}
        beat={gateBeat}
        onStart={beginCountdown}
      />
    );
  }

  if (session.state === "round_over") {
    return (
      <RoundOverScreen
        session={session}
        onNext={handoff}
        onLobby={backToLobby}
      />
    );
  }

  if (session.state === "game_over") {
    return (
      <GameOverScreen
        session={session}
        onLobby={backToLobby}
      />
    );
  }

  if (!card) {
    return <div className="flex flex-1 items-center justify-center" />;
  }

  const activeName =
    session.mode === "teams" ? teamName(session, session.activeTeam) : copy.modeTable;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-2xl font-black tabular-nums tracking-tight text-[var(--text-headline)]">
            {String(seconds).padStart(2, "0")}s
          </p>
          <p className="mt-0.5 font-sans text-[11px] font-bold uppercase tracking-wide text-[var(--text-body)]">
            {activeName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="font-sans text-xs font-bold uppercase tracking-wide text-[var(--text-headline)]">
            {copy.correctStat.replace("{n}", String(session.roundCorrect))}
          </p>
          <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-[var(--text-body)]">
            {copy.passLeftLabel.replace("{n}", String(session.passLeft))}
          </p>
        </div>
      </div>

      <div className="relative my-auto flex min-h-[360px] w-full items-center justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 h-[320px] w-full max-w-xs translate-x-2 translate-y-2 scale-[0.92] rotate-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card-surface)]/50 shadow-sm transition-all duration-300"
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-20 h-[320px] w-full max-w-xs rounded-3xl border-2 border-[var(--border)] bg-[var(--card-surface)]/80 shadow-md"
          animate={
            lifting
              ? { scale: 1, rotate: 0, x: 0, y: 0 }
              : { scale: 0.96, rotate: -3, x: -4, y: 4 }
          }
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        />
        <div className="relative z-30 w-full max-w-xs">
          <SwipeTabooCard
            key={`${session.cursor}-${card.word}`}
            card={card}
            passLeft={session.passLeft}
            stampCorrect={copy.stampCorrect}
            stampBurn={copy.stampBurn}
            stampPass={copy.stampPass}
            apiRef={swipeApi}
            onFlyStart={() => setLifting(true)}
            onSwipe={applySwipe}
          />
        </div>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 pb-1 pt-4">
        <button
          type="button"
          onClick={() => swipeApi.current?.play("burn")}
          className="min-h-12 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text-headline)_10%,transparent)] px-4 py-3.5 font-sans text-sm font-black text-[var(--text-headline)] transition active:scale-95"
        >
          {copy.burn}
        </button>
        <button
          type="button"
          disabled={session.passLeft <= 0}
          onClick={() => swipeApi.current?.play("pass")}
          className="min-h-12 rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] px-4 py-3.5 font-sans text-sm font-bold text-[var(--text-body)] transition active:scale-95 disabled:opacity-40"
        >
          {copy.pass.replace("{n}", String(session.passLeft))}
        </button>
        <button
          type="button"
          onClick={() => swipeApi.current?.play("correct")}
          className="min-h-12 rounded-2xl bg-[var(--btn-primary)] px-6 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95"
        >
          {copy.correct}
        </button>
      </div>
    </section>
  );
}

function finishRound(current: TabooSession): TabooSession {
  const teamAScore =
    current.mode === "teams" && current.activeTeam === "a"
      ? current.teamAScore + current.roundCorrect
      : current.teamAScore;
  const teamBScore =
    current.mode === "teams" && current.activeTeam === "b"
      ? current.teamBScore + current.roundCorrect
      : current.teamBScore;
  const tableWin = current.mode === "table" && current.roundCorrect >= TABLE_WIN;
  const teamWin =
    current.mode === "teams" &&
    (teamAScore >= TEAM_TARGET || teamBScore >= TEAM_TARGET);
  let winner: TabooSession["winner"] = null;
  if (tableWin) winner = "table";
  if (teamWin) winner = teamAScore >= TEAM_TARGET ? "a" : "b";
  return {
    ...current,
    teamAScore,
    teamBScore,
    endsAt: Date.now(),
    winner,
    state: winner ? "game_over" : "round_over",
  };
}

function SetupScreen({
  session,
  onMode,
  onTeamA,
  onTeamB,
  onStart,
}: {
  session: TabooSession;
  onMode: (mode: GameMode) => void;
  onTeamA: (name: string) => void;
  onTeamB: (name: string) => void;
  onStart: () => void;
}) {
  const copy = tenantConfig.copy.taboo;
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mt-1 grid gap-2">
        <ModeCard
          active={session.mode === "teams"}
          title={copy.modeTeams}
          lead={copy.modeTeamsLead.replace("{n}", String(TEAM_TARGET))}
          onClick={() => onMode("teams")}
        />
        <ModeCard
          active={session.mode === "table"}
          title={copy.modeTable}
          lead={copy.modeTableLead}
          onClick={() => onMode("table")}
        />
      </div>
      {session.mode === "teams" ? (
        <div className="mt-4 grid gap-2">
          <label className="block">
            <span className="mb-1 block font-sans text-[11px] font-bold uppercase tracking-wide text-[var(--text-body)]">
              {copy.teamALabel}
            </span>
            <input
              value={session.teamAName}
              onChange={(event) => onTeamA(event.target.value.slice(0, 24))}
              className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] px-4 font-sans text-sm font-bold text-[var(--text-headline)] outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-sans text-[11px] font-bold uppercase tracking-wide text-[var(--text-body)]">
              {copy.teamBLabel}
            </span>
            <input
              value={session.teamBName}
              onChange={(event) => onTeamB(event.target.value.slice(0, 24))}
              className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] px-4 font-sans text-sm font-bold text-[var(--text-headline)] outline-none"
            />
          </label>
        </div>
      ) : null}
      <div className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] p-4">
        <p className="font-sans text-[11px] font-black uppercase tracking-wider text-[var(--text-headline)]">
          {copy.howTitle}
        </p>
        <p className="mt-3 flex items-start gap-2 font-sans text-sm font-medium text-[var(--text-body)]">
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
          {copy.howTell}
        </p>
        <p className="mt-2 flex items-start gap-2 font-sans text-sm font-medium text-[var(--text-body)]">
          <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
          {copy.howWatch}
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-auto min-h-14 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95"
      >
        {copy.setupCta}
      </button>
    </section>
  );
}

function ModeCard({
  active,
  title,
  lead,
  onClick,
}: {
  active: boolean;
  title: string;
  lead: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-14 rounded-3xl border-2 px-4 py-3.5 text-left transition active:scale-95 ${
        active
          ? "border-[var(--btn-primary)] bg-[var(--btn-primary)] text-[var(--btn-text)]"
          : "border-[var(--border)] bg-[var(--card-surface)] text-[var(--text-headline)]"
      }`}
    >
      <span className="block font-sans text-sm font-black">{title}</span>
      <span
        className={`mt-1 block font-sans text-xs font-medium ${
          active ? "text-[var(--btn-text)]/80" : "text-[var(--text-body)]"
        }`}
      >
        {lead}
      </span>
    </button>
  );
}

function ReadyScreen({
  session,
  beat,
  onStart,
}: {
  session: TabooSession;
  beat: string | null;
  onStart: () => void;
}) {
  const copy = tenantConfig.copy.taboo;
  const team =
    session.mode === "teams" ? teamName(session, session.activeTeam) : copy.modeTable;
  if (beat) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-body)]">
          {tenantConfig.copy.landing.gameShell.countdownReady}
        </p>
        <p className="mt-3 font-sans text-7xl font-extrabold tracking-tight text-[var(--text-headline)]">
          {beat}
        </p>
      </section>
    );
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
      <h2 className="font-sans text-3xl font-black tracking-tight text-[var(--text-headline)]">
        {copy.turnTitle.replace("{team}", team)}
      </h2>
      <p className="mt-3 max-w-xs font-sans text-sm font-medium text-[var(--text-body)]">
        {copy.readyLead}
      </p>
      {session.mode === "teams" ? (
        <p className="mt-4 font-sans text-xs font-bold uppercase tracking-wide text-[var(--text-headline)]">
          {copy.scoreboard}: {session.teamAScore} – {session.teamBScore}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onStart}
        className="mt-8 min-h-14 w-full max-w-xs rounded-2xl bg-[var(--btn-primary)] px-4 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95"
      >
        {copy.readyCta}
      </button>
    </section>
  );
}

function RoundOverScreen({
  session,
  onNext,
  onLobby,
}: {
  session: TabooSession;
  onNext: () => void;
  onLobby: () => void;
}) {
  const copy = tenantConfig.copy.taboo;
  const upcoming =
    session.mode === "teams"
      ? teamName(session, nextTeam(session.activeTeam))
      : copy.modeTable;
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
      <div className="w-full max-w-xs rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] p-6 shadow-2xl">
        <h2 className="font-sans text-xl font-black tracking-tight text-[var(--text-headline)]">
          {copy.roundTitle}
        </h2>
        <p className="mt-4 font-sans text-sm font-bold text-[var(--text-headline)]">
          {copy.correctStat.replace("{n}", String(session.roundCorrect))}
        </p>
        <p className="mt-1 font-sans text-sm font-bold text-[var(--text-body)]">
          {copy.burnStat.replace("{n}", String(session.roundTabu))}
        </p>
        {session.mode === "teams" ? (
          <p className="mt-4 font-sans text-xs font-bold uppercase tracking-wide text-[var(--text-headline)]">
            {copy.scoreboard}: {session.teamAScore} – {session.teamBScore}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          className="mt-6 min-h-12 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95"
        >
          {session.mode === "teams"
            ? copy.nextTeamCta.replace("{team}", upcoming)
            : copy.retryCta}
        </button>
        <button
          type="button"
          onClick={onLobby}
          className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] px-4 py-3 font-sans text-sm font-bold text-[var(--text-headline)] transition active:scale-95"
        >
          {copy.lobbyCta}
        </button>
      </div>
    </section>
  );
}

function GameOverScreen({
  session,
  onLobby,
}: {
  session: TabooSession;
  onLobby: () => void;
}) {
  const copy = tenantConfig.copy.taboo;
  const title =
    session.winner === "table"
      ? copy.tableWinTitle
      : copy.winnerTitle.replace(
          "{team}",
          session.winner === "b" ? session.teamBName : session.teamAName,
        );
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
      <div className="w-full max-w-xs rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] p-6 shadow-2xl">
        <h2 className="font-sans text-xl font-black tracking-tight text-[var(--text-headline)]">
          {title}
        </h2>
        <p className="mt-2 font-sans text-sm font-medium text-[var(--text-body)]">
          {copy.winLead}
        </p>
        {session.mode === "teams" ? (
          <p className="mt-4 font-sans text-xs font-bold uppercase tracking-wide text-[var(--text-headline)]">
            {copy.scoreboard}: {session.teamAScore} – {session.teamBScore}
          </p>
        ) : (
          <p className="mt-4 font-sans text-sm font-bold text-[var(--text-headline)]">
            {copy.correctStat.replace("{n}", String(session.roundCorrect))}
          </p>
        )}
        <button
          type="button"
          onClick={onLobby}
          className="mt-6 min-h-12 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95"
        >
          {copy.lobbyCta}
        </button>
      </div>
    </section>
  );
}

function SwipeTabooCard({
  card,
  passLeft,
  stampCorrect,
  stampBurn,
  stampPass,
  apiRef,
  onFlyStart,
  onSwipe,
}: {
  card: TabooCard;
  passLeft: number;
  stampCorrect: string;
  stampBurn: string;
  stampPass: string;
  apiRef: MutableRefObject<{ play: (kind: SwipeKind) => void } | null>;
  onFlyStart: () => void;
  onSwipe: (kind: SwipeKind) => void;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false);
  const passLeftRef = useRef(passLeft);
  const onSwipeRef = useRef(onSwipe);
  const onFlyStartRef = useRef(onFlyStart);
  passLeftRef.current = passLeft;
  onSwipeRef.current = onSwipe;
  onFlyStartRef.current = onFlyStart;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(0);
  const [hint, setHint] = useState<StampHint>(null);
  const [lockDrag, setLockDrag] = useState(false);

  const flyOff = useCallback(async (kind: SwipeKind) => {
    if (busyRef.current) return;
    if (kind === "pass" && passLeftRef.current <= 0) {
      busyRef.current = true;
      setLockDrag(true);
      setHint({ kind: "pass", opacity: 1 });
      await animate(x, [0, -12, 12, -10, 10, -6, 6, 0], { duration: 0.35 });
      rotate.set(0);
      y.set(0);
      setHint(null);
      setLockDrag(false);
      busyRef.current = false;
      return;
    }
    busyRef.current = true;
    setLockDrag(true);
    setHint({ kind, opacity: 1 });
    onFlyStartRef.current();
    const width = cardRef.current?.offsetWidth ?? 320;
    const height = cardRef.current?.offsetHeight ?? 320;
    const dest =
      kind === "correct"
        ? { x: width * 1.5, y: 0, rotate: 15 }
        : kind === "burn"
          ? { x: -width * 1.5, y: 0, rotate: -15 }
          : { x: 0, y: height * 1.2, rotate: 0 };
    try {
      await Promise.race([
        Promise.all([
          animate(x, dest.x, { duration: 0.22, ease: "easeOut" }),
          animate(y, dest.y, { duration: 0.22, ease: "easeOut" }),
          animate(rotate, dest.rotate, { duration: 0.22, ease: "easeOut" }),
        ]),
        new Promise((resolve) => window.setTimeout(resolve, 280)),
      ]);
    } finally {
      onSwipeRef.current(kind);
    }
  }, [rotate, x, y]);

  useEffect(() => {
    apiRef.current = { play: (kind) => void flyOff(kind) };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, flyOff]);

  return (
    <motion.article
      ref={cardRef}
      drag={!lockDrag}
      dragMomentum={false}
      style={{ x, y, rotate, touchAction: "none" }}
      initial={{ scale: 0.96 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      onDrag={(_, info) => {
        rotate.set(info.offset.x * 0.08);
        setHint(hintFromOffset(info.offset.x, info.offset.y));
      }}
      onDragEnd={(_, info) => {
        if (busyRef.current) return;
        const kind = resolveSwipe(info.offset.x, info.offset.y);
        if (kind) {
          void flyOff(kind);
          return;
        }
        setHint(null);
        void Promise.all([
          animate(x, 0, { duration: 0.25, ease: "easeOut" }),
          animate(y, 0, { duration: 0.25, ease: "easeOut" }),
          animate(rotate, 0, { duration: 0.25, ease: "easeOut" }),
        ]);
      }}
      className="flex min-h-[320px] w-full cursor-grab select-none flex-col justify-center rounded-3xl border-4 border-[var(--border)] bg-[var(--card-surface)] p-6 text-center shadow-2xl active:cursor-grabbing"
    >
      <StampOverlay
        hint={hint}
        stampCorrect={stampCorrect}
        stampBurn={stampBurn}
        stampPass={stampPass}
      />
      <h2 className="border-b-2 border-[var(--border)] pb-4 font-sans text-2xl font-black uppercase tracking-wider text-[var(--text-headline)]">
        {card.word}
      </h2>
      <ul className="mt-3">
        {card.forbidden.slice(0, 5).map((word) => (
          <li
            key={word}
            className="py-1.5 font-sans text-base font-bold uppercase tracking-wide text-[var(--text-body)] opacity-90"
          >
            {word}
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

function StampOverlay({
  hint,
  stampCorrect,
  stampBurn,
  stampPass,
}: {
  hint: StampHint;
  stampCorrect: string;
  stampBurn: string;
  stampPass: string;
}) {
  const stamps: Array<{ kind: SwipeKind; label: string; className: string; position: string }> = [
    {
      kind: "correct",
      label: stampCorrect,
      className: "border-[var(--btn-primary)] bg-[var(--btn-primary)] text-[var(--btn-text)]",
      position: "left-4 top-6 -rotate-12",
    },
    {
      kind: "burn",
      label: stampBurn,
      className: "border-[var(--text-headline)] text-[var(--text-headline)]",
      position: "right-4 top-6 rotate-12",
    },
    {
      kind: "pass",
      label: stampPass,
      className: "border-[var(--border)] bg-[var(--card-surface)] text-[var(--text-body)]",
      position: "inset-x-0 top-1/2 -translate-y-1/2",
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[1.35rem]">
      {stamps.map((stamp) => {
        const active = hint?.kind === stamp.kind;
        const opacity = active ? hint.opacity : 0;
        return (
          <span
            key={stamp.kind}
            className={`absolute rounded-xl border-4 px-3 py-1 font-sans text-2xl font-black tracking-widest ${stamp.className} ${stamp.position}`}
            style={{ opacity }}
          >
            {stamp.label}
          </span>
        );
      })}
    </div>
  );
}
