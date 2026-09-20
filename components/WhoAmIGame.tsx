"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Eye, Smartphone } from "lucide-react";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { clearArcadeGameSession } from "@/lib/arcadeSession";
import { confirmStampVisit } from "@/lib/stampCard";
import { getActiveTableLabel } from "@/lib/tableSession";
import {
  WHOAMI_CATEGORY_IDS,
  whoAmIDeck,
  type WhoAmICategoryId,
  type WhoAmIEntry,
} from "@/lib/whoAmIWords";

const ROUND_MS = 60_000;
const WIN_CORRECT = 5;
const FLASH_MS = 600;
const COOLDOWN_MS = 1_200;
const COUNTDOWN_MS = 700;
const TILT_TRIGGER = 40;
const TILT_NEUTRAL = 28;

type WhoAmIState = "setup" | "hold" | "playing" | "over";
type FlashKind = "correct" | "pass" | null;
type TiltZone = "neutral" | "down" | "up" | "mid";

type WhoAmISession = {
  state: WhoAmIState;
  category: WhoAmICategoryId;
  deck: WhoAmIEntry[];
  cursor: number;
  correct: number;
  endsAt: number | null;
  rewarded: boolean;
};

type DeviceOrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

function storageKey(tenantId: string): string {
  return `whoami_session_${tenantId}`;
}

function remainingSeconds(endsAt: number | null): number {
  if (endsAt == null) return 60;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
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

function blankSession(): WhoAmISession {
  return {
    state: "setup",
    category: "mix",
    deck: [],
    cursor: 0,
    correct: 0,
    endsAt: null,
    rewarded: false,
  };
}

function readSession(tenantId: string): WhoAmISession {
  const fallback = blankSession();
  if (typeof window === "undefined" || !tenantId) return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WhoAmISession>;
    const category = WHOAMI_CATEGORY_IDS.includes(parsed.category as WhoAmICategoryId)
      ? (parsed.category as WhoAmICategoryId)
      : "mix";
    if (parsed.state && parsed.state !== "setup") {
      clearArcadeGameSession("whoami", tenantId);
    }
    return {
      ...fallback,
      category,
      state: "setup",
    };
  } catch {
    return fallback;
  }
}

function writeSession(tenantId: string, session: WhoAmISession): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    if (session.state === "setup") {
      window.localStorage.setItem(storageKey(tenantId), JSON.stringify(session));
      return;
    }
    clearArcadeGameSession("whoami", tenantId);
  } catch {
    // Private mode may block storage.
  }
}

function isLandscapeViewport(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(orientation: landscape)").matches;
  }
  return window.innerWidth > window.innerHeight;
}

/** Forehead nod angle relative to a calibrated baseline (degrees). */
function nodDelta(event: DeviceOrientationEvent, baseline: number): number {
  const beta = event.beta ?? 0;
  const gamma = event.gamma ?? 0;
  let nod: number;
  if (isLandscapeViewport()) {
    const type = window.screen?.orientation?.type ?? "";
    // landscape-secondary flips the gamma sign vs primary.
    nod = type.includes("secondary") ? -gamma : gamma;
  } else {
    nod = beta - 90;
  }
  return nod - baseline;
}

function tiltZone(delta: number): TiltZone {
  if (delta <= -TILT_TRIGGER) return "down";
  if (delta >= TILT_TRIGGER) return "up";
  if (Math.abs(delta) <= TILT_NEUTRAL) return "neutral";
  return "mid";
}

async function requestOrientationPermission(): Promise<void> {
  const ctor = window.DeviceOrientationEvent as DeviceOrientationCtor | undefined;
  if (typeof ctor?.requestPermission !== "function") return;
  try {
    await Promise.race([
      ctor.requestPermission(),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1200);
      }),
    ]);
  } catch {
    // Fallback taps still work.
  }
}

type ScreenOrientationLock = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
};

function unlockOrientation(): void {
  try {
    window.screen.orientation?.unlock?.();
  } catch {
    // ignore
  }
}

async function lockLandscape(): Promise<void> {
  try {
    const orientation = window.screen.orientation as ScreenOrientationLock | undefined;
    await orientation?.lock?.("landscape");
  } catch {
    // Desktop and many browsers skip lock.
  }
}

function buzz(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // iOS may ignore vibration.
  }
}

function chime(kind: "correct" | "pass"): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === "correct" ? "triangle" : "sine";
    osc.frequency.value = kind === "correct" ? 880 : 420;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
    window.setTimeout(() => void ctx.close(), 320);
  } catch {
    // ignore
  }
}

export function WhoAmIGame() {
  const copy = tenantConfig.copy.whoami;
  const shell = tenantConfig.copy.landing.gameShell;
  const { tenantId, player } = useDuel();
  const [session, setSession] = useState<WhoAmISession | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashKind>(null);
  const rewardedRef = useRef(false);
  const sessionRef = useRef<WhoAmISession | null>(null);
  const busyRef = useRef(false);
  const needsNeutralRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const flashWordRef = useRef<string>("");
  const tiltBaselineRef = useRef(0);
  const calibratingRef = useRef(false);
  sessionRef.current = session;

  const persist = useCallback(
    (next: WhoAmISession) => {
      sessionRef.current = next;
      writeSession(tenantId, next);
      setSession(next);
    },
    [tenantId],
  );

  const resetMatch = useCallback(() => {
    rewardedRef.current = false;
    busyRef.current = false;
    needsNeutralRef.current = false;
    cooldownUntilRef.current = 0;
    setCountdown(null);
    setFlash(null);
    unlockOrientation();
    clearArcadeGameSession("whoami", tenantId);
    const blank = blankSession();
    sessionRef.current = blank;
    setSession(blank);
    setSeconds(60);
  }, [tenantId]);

  useEffect(() => {
    const next = readSession(tenantId);
    setSession(next);
    setSeconds(remainingSeconds(next.endsAt));
  }, [tenantId]);

  useEffect(() => {
    const tick = () => {
      const current = sessionRef.current;
      if (!current || current.state !== "playing") return;
      const left = remainingSeconds(current.endsAt);
      setSeconds(left);
      if (left > 0) return;
      persist({ ...current, state: "over", endsAt: Date.now() });
      unlockOrientation();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [persist]);

  useEffect(() => {
    if (!countdown) return;
    const beats = ["3", "2", "1", shell.countdownGo];
    const index = beats.indexOf(countdown);
    const timer = window.setTimeout(() => {
      if (index >= beats.length - 1) {
        setCountdown(null);
        const current = sessionRef.current ?? blankSession();
        persist({
          ...current,
          state: "playing",
          deck: current.deck.length ? current.deck : whoAmIDeck(current.category),
          cursor: 0,
          correct: 0,
          endsAt: Date.now() + ROUND_MS,
          rewarded: false,
        });
        rewardedRef.current = false;
        busyRef.current = false;
        needsNeutralRef.current = true;
        cooldownUntilRef.current = Date.now() + 400;
        setSeconds(60);
        return;
      }
      setCountdown(beats[index + 1] ?? null);
    }, COUNTDOWN_MS);
    return () => window.clearTimeout(timer);
  }, [countdown, persist, shell.countdownGo]);

  const won = (session?.correct ?? 0) >= WIN_CORRECT && session?.state === "over";

  useEffect(() => {
    if (!won) return;
    void confetti({
      particleCount: 150,
      spread: 74,
      startVelocity: 36,
      origin: { y: 0.4 },
      colors: themeConfettiColors(),
    });
  }, [won]);

  useEffect(() => {
    if (!session || !won || session.rewarded || rewardedRef.current) return;
    rewardedRef.current = true;
    void confirmStampVisit({
      tenantId,
      clientId: player.clientId,
      tableId: getActiveTableLabel(tenantId),
    }).then(() => {
      const current = sessionRef.current;
      if (!current) return;
      persist({ ...current, rewarded: true });
    });
  }, [persist, player.clientId, session, tenantId, won]);

  const advance = useCallback(
    (kind: "correct" | "pass") => {
      const current = sessionRef.current;
      if (!current || current.state !== "playing") return;
      const nextCursor = current.cursor + 1;
      persist({
        ...current,
        correct: kind === "correct" ? current.correct + 1 : current.correct,
        cursor: nextCursor,
        deck:
          nextCursor >= current.deck.length
            ? whoAmIDeck(current.category)
            : current.deck,
      });
    },
    [persist],
  );

  const flashAndAdvance = useCallback(
    (kind: "correct" | "pass") => {
      const current = sessionRef.current;
      if (!current || current.state !== "playing" || busyRef.current) return;
      busyRef.current = true;
      needsNeutralRef.current = true;
      cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
      const entry = current.deck[current.cursor % Math.max(current.deck.length, 1)];
      flashWordRef.current = entry?.name ?? copy.empty;
      setFlash(kind);
      if (kind === "correct") buzz(100);
      chime(kind);
      window.setTimeout(() => {
        advance(kind);
        setFlash(null);
        busyRef.current = false;
      }, FLASH_MS);
    },
    [advance, copy.empty],
  );

  useEffect(() => {
    if (session?.state !== "playing" || countdown) return;
    const onOrient = (event: DeviceOrientationEvent) => {
      if (Date.now() < cooldownUntilRef.current) return;
      const delta = nodDelta(event, tiltBaselineRef.current);
      const zone = tiltZone(delta);
      if (needsNeutralRef.current) {
        if (zone === "neutral") needsNeutralRef.current = false;
        return;
      }
      if (zone === "down") flashAndAdvance("correct");
      if (zone === "up") flashAndAdvance("pass");
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [countdown, flashAndAdvance, session?.state]);

  /** Sample forehead rest pose during countdown so landscape gamma bias does not lock tilts. */
  useEffect(() => {
    if (!countdown) return;
    calibratingRef.current = true;
    const samples: number[] = [];
    const onOrient = (event: DeviceOrientationEvent) => {
      samples.push(nodDelta(event, 0));
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      if (samples.length > 0) {
        const sorted = [...samples].sort((a, b) => a - b);
        tiltBaselineRef.current = sorted[Math.floor(sorted.length / 2)] ?? 0;
      }
      calibratingRef.current = false;
      needsNeutralRef.current = false;
    };
  }, [countdown]);

  function goHold() {
    const current = sessionRef.current ?? blankSession();
    persist({
      ...current,
      state: "hold",
      deck: whoAmIDeck(current.category),
      cursor: 0,
      correct: 0,
      endsAt: null,
      rewarded: false,
    });
    rewardedRef.current = false;
  }

  async function beginFromForehead() {
    await requestOrientationPermission();
    await lockLandscape();
    setCountdown("3");
  }

  if (!session) {
    return <div className="flex flex-1 items-center justify-center" />;
  }

  if (session.state === "setup") {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mt-1 grid grid-cols-2 gap-2">
          {WHOAMI_CATEGORY_IDS.map((id) => {
            const active = session.category === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => persist({ ...session, category: id })}
                className={`min-h-12 rounded-2xl border-2 px-3 py-3 font-sans text-sm font-black transition active:scale-95 ${
                  active
                    ? "border-[var(--btn-primary)] bg-[var(--btn-primary)] text-[var(--btn-text)]"
                    : "border-[var(--border)] bg-[var(--card-surface)] text-[var(--text-headline)]"
                }`}
              >
                {copy.categories[id]}
              </button>
            );
          })}
        </div>
        <div className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] p-4">
          <p className="font-sans text-[11px] font-black uppercase tracking-wider text-[var(--text-headline)]">
            {copy.howTitle}
          </p>
          <p className="mt-3 flex items-start gap-2 font-sans text-sm font-medium text-[var(--text-body)]">
            <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
            {copy.howHold}
          </p>
          <p className="mt-2 flex items-start gap-2 font-sans text-sm font-medium text-[var(--text-body)]">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
            {copy.howAsk}
          </p>
        </div>
        <button
          type="button"
          onClick={goHold}
          className="mt-auto min-h-14 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95"
        >
          {copy.startCta}
        </button>
      </section>
    );
  }

  if (session.state === "over") {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
        <div className="w-full max-w-xs rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] p-6 shadow-2xl">
          <h2 className="font-sans text-xl font-black tracking-tight text-[var(--text-headline)]">
            {won ? copy.winTitle : copy.retryTitle}
          </h2>
          <p className="mt-2 font-sans text-sm font-medium text-[var(--text-body)]">
            {won ? copy.winLead : copy.retryLead}
          </p>
          <p className="mt-4 font-sans text-sm font-bold text-[var(--text-headline)]">
            {copy.scoreStat.replace("{n}", String(session.correct))}
          </p>
          <button
            type="button"
            onClick={goHold}
            className="mt-6 min-h-12 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95"
          >
            {copy.retryCta}
          </button>
          <button
            type="button"
            onClick={resetMatch}
            className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] px-4 py-3 font-sans text-sm font-bold text-[var(--text-headline)] transition active:scale-95"
          >
            {copy.lobbyCta}
          </button>
        </div>
      </section>
    );
  }

  if (session.state === "hold" && !countdown) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center px-2 text-center">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="flex size-28 items-center justify-center rounded-[2rem] border-2 border-[var(--border)] bg-[var(--card-surface)]">
            <Smartphone
              aria-hidden
              className="size-16 rotate-90 text-[var(--text-headline)]"
            />
          </div>
          <h2 className="mt-6 max-w-xs font-sans text-2xl font-black tracking-tight text-[var(--text-headline)]">
            {copy.holdTitle}
          </h2>
          <p className="mt-3 max-w-xs font-sans text-base font-medium text-[var(--text-body)]">
            {copy.holdLead}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void beginFromForehead()}
          className="mt-auto min-h-14 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95"
        >
          {copy.holdCta}
        </button>
      </section>
    );
  }

  const liveEntry = session.deck[session.cursor % Math.max(session.deck.length, 1)];
  const word = flash ? flashWordRef.current : (liveEntry?.name ?? copy.empty);
  const categoryId = liveEntry?.category;

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-y-auto select-none">
      {countdown ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-body)]">
            {shell.countdownReady}
          </p>
          <p className="mt-3 font-sans text-7xl font-extrabold tracking-tight text-[var(--text-headline)] landscape:text-5xl">
            {countdown}
          </p>
        </div>
      ) : (
        <>
          <div className="relative z-20 flex shrink-0 items-start justify-between gap-3">
            <div>
              <p className="font-sans text-4xl font-black tabular-nums tracking-tight text-[var(--text-headline)] landscape:text-3xl">
                {String(seconds).padStart(2, "0")}s
              </p>
              <p className="mt-0.5 font-sans text-[10px] font-bold uppercase tracking-widest text-[var(--text-body)]/70">
                {copy.tapPass}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="font-sans text-xs font-bold uppercase tracking-wide text-[var(--text-headline)]">
                {copy.scoreStat.replace("{n}", String(session.correct))}
              </p>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[var(--text-body)]/70">
                {copy.tapCorrect}
              </p>
            </div>
          </div>

          <div className="relative mt-2 min-h-0 flex-1">
            <button
              type="button"
              aria-label={copy.pass}
              onClick={() => flashAndAdvance("pass")}
              className="absolute inset-y-0 left-0 z-10 w-1/2 touch-manipulation"
            />
            <button
              type="button"
              aria-label={copy.correct}
              onClick={() => flashAndAdvance("correct")}
              className="absolute inset-y-0 right-0 z-10 w-1/2 touch-manipulation"
            />
            <div className="pointer-events-none flex h-full min-h-0 flex-col items-center justify-center px-2 py-1">
              <article className="flex w-full flex-1 max-h-full min-h-[120px] flex-col items-center justify-center rounded-3xl border-4 border-[var(--border)] bg-[var(--card-surface)] px-4 py-4 text-center shadow-2xl landscape:py-3 sm:py-6">
                <h2 className="text-center font-sans text-3xl font-black tracking-wider text-[var(--text-headline)] uppercase sm:text-4xl landscape:text-3xl md:text-5xl">
                  {word}
                </h2>
                {categoryId ? (
                  <span className="mt-3 rounded-full bg-[var(--btn-primary)]/15 px-3 py-1 font-sans text-xs font-bold text-[var(--btn-primary)] landscape:mt-2">
                    {copy.categories[categoryId]}
                  </span>
                ) : null}
              </article>
            </div>
          </div>
        </>
      )}

      {flash ? (
        <div
          className={`absolute inset-0 z-30 flex items-center justify-center ${
            flash === "correct"
              ? "bg-[var(--quiz-ok)]"
              : "bg-[var(--accent)]"
          }`}
        >
          <p className="font-sans text-5xl font-black tracking-widest text-[var(--quiz-on-feedback)] uppercase landscape:text-4xl">
            {flash === "correct" ? copy.flashCorrect : copy.flashPass}
          </p>
        </div>
      ) : null}
    </section>
  );
}

