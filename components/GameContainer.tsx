"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Hourglass, WifiOff, X } from "lucide-react";
import { tenantConfig, type DuelGameId } from "@/config/tenant.config";
import {
  deterministicNumber,
  useDuelClock,
  type DuelMatch,
  type DuelPlayer,
} from "@/lib/duel";
import { getSupabase } from "@/lib/supabase";

const COUNTDOWN_MS = 3000;
const READY_RESEND_MS = 500;
const CONNECT_TIMEOUT_MS = 8000;

type GameContainerProps = {
  match: DuelMatch;
  player: DuelPlayer;
  onExit: () => void;
};

type ScorePayload = { playerId: string; score: number };
type StartPayload = { startAt: number };
type PlayerPayload = { playerId: string };

export function GameContainer({
  match,
  player,
  onExit,
}: GameContainerProps) {
  const copy = tenantConfig.copy.duel;
  const supabase = useMemo(() => getSupabase(), []);
  const host = player.clientId.localeCompare(match.opponent.clientId) < 0;
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(
    null,
  );
  const localScoreRef = useRef(0);
  const localFinalRef = useRef<number | null>(null);
  const localRematchRef = useRef(false);
  const startSentRef = useRef(false);
  const localReadyRef = useRef(false);
  const remoteReadyRef = useRef(false);
  const readyResendTimerRef = useRef<number | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const restartHandshakeRef = useRef<() => void>(() => {});
  const [startAt, setStartAt] = useState<number | null>(null);
  const [localScore, setLocalScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [localFinal, setLocalFinal] = useState<number | null>(null);
  const [opponentFinal, setOpponentFinal] = useState<number | null>(null);
  const [rematchIncoming, setRematchIncoming] = useState(false);
  const [connectFailed, setConnectFailed] = useState(false);

  const send = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      void channelRef.current?.send({
        type: "broadcast",
        event,
        payload,
      });
    },
    [],
  );

  const resetGame = useCallback(() => {
    localScoreRef.current = 0;
    localFinalRef.current = null;
    localRematchRef.current = false;
    startSentRef.current = false;
    setStartAt(null);
    setLocalScore(0);
    setOpponentScore(0);
    setLocalFinal(null);
    setOpponentFinal(null);
    setRematchIncoming(false);
  }, []);

  const launchIfHost = useCallback(() => {
    if (!host || startSentRef.current) return;
    startSentRef.current = true;
    const nextStart = Date.now() + COUNTDOWN_MS;
    setStartAt(nextStart);
    send("game_start", { startAt: nextStart });
  }, [host, send]);

  useEffect(() => {
    if (!supabase) return;
    localReadyRef.current = false;
    remoteReadyRef.current = false;

    const channel = supabase.channel(`match_${match.id}`, {
      config: { broadcast: { self: false } },
    });

    function clearReadyResend() {
      if (readyResendTimerRef.current != null) {
        window.clearInterval(readyResendTimerRef.current);
        readyResendTimerRef.current = null;
      }
    }

    function clearConnectTimeout() {
      if (connectTimeoutRef.current != null) {
        window.clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
    }

    function sendPlayerReady() {
      void channel.send({
        type: "broadcast",
        event: "player_ready",
        payload: { playerId: player.clientId },
      });
    }

    function beginReadyHandshake() {
      clearReadyResend();
      clearConnectTimeout();
      localReadyRef.current = true;
      sendPlayerReady();
      readyResendTimerRef.current = window.setInterval(() => {
        if (remoteReadyRef.current) {
          clearReadyResend();
          return;
        }
        sendPlayerReady();
      }, READY_RESEND_MS);
      connectTimeoutRef.current = window.setTimeout(() => {
        if (!(localReadyRef.current && remoteReadyRef.current)) {
          clearReadyResend();
          setConnectFailed(true);
        }
      }, CONNECT_TIMEOUT_MS);
      checkBothReady();
    }

    function checkBothReady() {
      if (localReadyRef.current && remoteReadyRef.current) {
        clearReadyResend();
        clearConnectTimeout();
        launchIfHost();
      }
    }

    restartHandshakeRef.current = beginReadyHandshake;

    channel
      .on("broadcast", { event: "player_ready" }, ({ payload }) => {
        const ready = payload as PlayerPayload;
        if (ready.playerId === player.clientId) return;
        remoteReadyRef.current = true;
        checkBothReady();
      })
      .on("broadcast", { event: "game_start" }, ({ payload }) => {
        const start = payload as StartPayload;
        startSentRef.current = true;
        setStartAt(start.startAt);
      })
      .on("broadcast", { event: "score" }, ({ payload }) => {
        const score = payload as ScorePayload;
        if (score.playerId !== player.clientId) setOpponentScore(score.score);
      })
      .on("broadcast", { event: "finish" }, ({ payload }) => {
        const result = payload as ScorePayload;
        if (result.playerId === player.clientId) return;
        setOpponentScore(result.score);
        setOpponentFinal(result.score);
        if (match.gameId === "number" && localFinalRef.current == null) {
          localFinalRef.current = 0;
          setLocalFinal(0);
          void channel.send({
            type: "broadcast",
            event: "finish",
            payload: { playerId: player.clientId, score: 0 },
          });
        }
      })
      .on("broadcast", { event: "rematch" }, ({ payload }) => {
        const request = payload as PlayerPayload;
        if (request.playerId === player.clientId) return;
        if (localRematchRef.current) {
          resetGame();
          remoteReadyRef.current = false;
          beginReadyHandshake();
        } else {
          setRematchIncoming(true);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          beginReadyHandshake();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearReadyResend();
          clearConnectTimeout();
          setConnectFailed(true);
        }
      });

    channelRef.current = channel;
    return () => {
      clearReadyResend();
      clearConnectTimeout();
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    launchIfHost,
    match.gameId,
    match.id,
    player.clientId,
    resetGame,
    supabase,
  ]);

  const awardPoints = useCallback(
    (points: number) => {
      const next = localScoreRef.current + points;
      localScoreRef.current = next;
      setLocalScore(next);
      send("score", { playerId: player.clientId, score: next });
    },
    [player.clientId, send],
  );

  const setAbsoluteScore = useCallback(
    (score: number) => {
      localScoreRef.current = score;
      setLocalScore(score);
      send("score", { playerId: player.clientId, score });
    },
    [player.clientId, send],
  );

  const finish = useCallback(
    (score = localScoreRef.current) => {
      if (localFinalRef.current != null) return;
      localFinalRef.current = score;
      setLocalFinal(score);
      send("finish", { playerId: player.clientId, score });
    },
    [player.clientId, send],
  );

  function requestRematch() {
    send("rematch", { playerId: player.clientId });
    if (rematchIncoming) {
      resetGame();
      remoteReadyRef.current = false;
      restartHandshakeRef.current();
      return;
    }
    localRematchRef.current = true;
  }

  const finished = localFinal != null && opponentFinal != null;
  const now = useDuelClock(100);
  const counting = startAt != null && now < startAt;

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-background">
      <div className="flex h-dvh w-full max-w-md flex-col overflow-hidden px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {!finished ? (
          <header className="flex items-center justify-between gap-3">
            <ScorePill
              label={copy.you}
              name={`${player.avatar} ${player.nickname}`}
              score={localScore}
              maxScore={scoreCeiling(match.gameId)}
              align="left"
            />
            <button
              type="button"
              onClick={onExit}
              aria-label={copy.returnToTable}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink"
            >
              <X className="size-4" />
            </button>
            <ScorePill
              label={copy.opponent}
              name={`${match.opponent.avatar} ${match.opponent.nickname}`}
              score={opponentScore}
              maxScore={scoreCeiling(match.gameId)}
              align="right"
            />
          </header>
        ) : null}

        <main className="flex min-h-0 flex-1 flex-col pt-5">
          {finished ? (
            <ResultScreen
              localScore={localFinal}
              opponentScore={opponentFinal}
              rematchIncoming={rematchIncoming}
              onRematch={requestRematch}
              onExit={onExit}
            />
          ) : localFinal != null ? (
            <FinishedWaiting score={localFinal} />
          ) : connectFailed ? (
            <ConnectionFailed onExit={onExit} />
          ) : startAt == null ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm font-medium tracking-wide text-muted">
              <span className="animate-pulse">{copy.waitingOpponent}</span>
            </div>
          ) : counting ? (
            <StartCountdown startAt={startAt} now={now} />
          ) : (
            <GameEngine
              key={`${match.id}-${startAt}`}
              gameId={match.gameId}
              matchId={match.id}
              startAt={startAt}
              onPoints={awardPoints}
              onSetScore={setAbsoluteScore}
              onFinish={finish}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ConnectionFailed({ onExit }: { onExit: () => void }) {
  const copy = tenantConfig.copy.duel;
  useEffect(() => {
    const timer = window.setTimeout(onExit, 1800);
    return () => window.clearTimeout(timer);
  }, [onExit]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 flex-col items-center justify-center text-center"
    >
      <WifiOff className="size-8 text-red-500" />
      <p className="mt-4 text-sm font-medium tracking-wide text-muted">
        {copy.connectionFailed}
      </p>
    </motion.div>
  );
}

function StartCountdown({ startAt, now }: { startAt: number; now: number }) {
  const copy = tenantConfig.copy.duel;
  const secondsLeft =
    now === 0
      ? Math.ceil(COUNTDOWN_MS / 1000)
      : Math.max(0, Math.ceil((startAt - now) / 1000));
  const label = secondsLeft > 0 ? String(secondsLeft) : copy.countdownGo;
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.p
          key={label}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="font-display text-7xl text-primary"
        >
          {label}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function FinishedWaiting({ score }: { score: number }) {
  const copy = tenantConfig.copy.duel;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 flex-col items-center justify-center text-center"
    >
      <Hourglass className="size-8 animate-pulse text-primary" />
      <h2 className="mt-5 font-display text-3xl leading-tight text-ink">
        {copy.finishedTitle}
      </h2>
      <p className="mt-3 text-sm font-medium tracking-wide text-muted">
        {copy.finishedScoreTemplate.replace("{score}", String(score))}
      </p>
    </motion.div>
  );
}

function ScorePill({
  label,
  name,
  score,
  maxScore,
  align,
}: {
  label: string;
  name: string;
  score: number;
  maxScore: number;
  align: "left" | "right";
}) {
  return (
    <div className={`min-w-0 flex-1 ${align === "right" ? "text-right" : ""}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
        {label}
      </p>
      <p className="truncate text-xs font-medium tracking-wide text-ink">{name}</p>
      <p className="font-display text-xl tabular-nums text-primary">{score}</p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full bg-primary transition-[width] duration-300 ${
            align === "right" ? "ml-auto" : ""
          }`}
          style={{ width: `${Math.min(100, (score / maxScore) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function scoreCeiling(gameId: DuelGameId): number {
  if (gameId === "trivia") return 1000;
  if (gameId === "emoji") return 800;
  if (gameId === "swipe") return tenantConfig.duel.swipe.length;
  return 1;
}

function GameEngine({
  gameId,
  matchId,
  startAt,
  onPoints,
  onSetScore,
  onFinish,
}: {
  gameId: DuelGameId;
  matchId: string;
  startAt: number;
  onPoints: (points: number) => void;
  onSetScore: (score: number) => void;
  onFinish: (score?: number) => void;
}) {
  if (gameId === "trivia" || gameId === "emoji") {
    return (
      <ChoiceRounds gameId={gameId} onPoints={onPoints} onFinish={onFinish} />
    );
  }
  if (gameId === "swipe") {
    return (
      <SwipeRush
        startAt={startAt}
        onSetScore={onSetScore}
        onFinish={onFinish}
      />
    );
  }
  return (
    <NumberRush
      matchId={matchId}
      startAt={startAt}
      onSetScore={onSetScore}
      onFinish={onFinish}
    />
  );
}

type ChoiceItem = (typeof tenantConfig.duel.trivia)[number] | (typeof tenantConfig.duel.emoji)[number];

function ChoiceRounds({
  gameId,
  onPoints,
  onFinish,
}: {
  gameId: "trivia" | "emoji";
  onPoints: (points: number) => void;
  onFinish: (score?: number) => void;
}) {
  const items =
    gameId === "trivia" ? tenantConfig.duel.trivia : tenantConfig.duel.emoji;
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (round >= items.length) onFinish();
  }, [items.length, onFinish, round]);

  if (round >= items.length) return null;

  return (
    <RoundView
      key={round}
      item={items[round]}
      round={round}
      total={items.length}
      onPoints={onPoints}
      onAdvance={() => setRound((current) => current + 1)}
    />
  );
}

function RoundView({
  item,
  round,
  total,
  onPoints,
  onAdvance,
}: {
  item: ChoiceItem;
  round: number;
  total: number;
  onPoints: (points: number) => void;
  onAdvance: () => void;
}) {
  const copy = tenantConfig.copy.duel;
  const [remaining, setRemaining] = useState(10_000);
  const [selected, setSelected] = useState<number | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, 10_000 - (Date.now() - start));
      setRemaining(left);
      if (left <= 0 && !settledRef.current) {
        settledRef.current = true;
        window.clearInterval(timer);
        onAdvance();
      }
    }, 100);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(index: number) {
    if (selected != null || settledRef.current) return;
    setSelected(index);
    if (index === item.answer) {
      onPoints(100 + Math.ceil(remaining / 100));
    }
    window.setTimeout(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      onAdvance();
    }, 650);
  }

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.1em] text-muted">
        <span>
          {copy.roundTemplate
            .replace("{current}", String(round + 1))
            .replace("{total}", String(total))}
        </span>
        <span>{copy.seconds.replace("{seconds}", String(Math.ceil(remaining / 1000)))}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-100"
          style={{ width: `${remaining / 100}%` }}
        />
      </div>
      <div className="flex flex-1 flex-col justify-center py-6">
        {"emojis" in item ? (
          <p className="mb-6 text-center text-6xl tracking-wider">{item.emojis}</p>
        ) : null}
        <h2 className="text-center font-display text-2xl leading-tight text-ink">
          {"prompt" in item ? item.prompt : ""}
        </h2>
        <div className="mt-7 grid gap-3">
          {item.options.map((option, index) => {
            const chosen = selected === index;
            const correct = selected != null && index === item.answer;
            return (
              <button
                key={option}
                type="button"
                disabled={selected != null}
                onClick={() => choose(index)}
                className={`min-h-14 rounded-2xl px-4 text-left text-sm font-medium transition-colors ${
                  correct
                    ? "bg-perfect text-white"
                    : chosen
                      ? "bg-red-500 text-white"
                      : "bg-surface text-ink"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SwipeRush({
  startAt,
  onSetScore,
  onFinish,
}: {
  startAt: number;
  onSetScore: (score: number) => void;
  onFinish: (score?: number) => void;
}) {
  const copy = tenantConfig.copy.duel;
  const claims = tenantConfig.duel.swipe;
  const now = useDuelClock();
  const remaining = Math.max(0, 30_000 - (now - startAt));
  const [index, setIndex] = useState(0);
  const streakRef = useRef(0);
  const bestRef = useRef(0);

  useEffect(() => {
    if (remaining <= 0) onFinish(bestRef.current);
  }, [onFinish, remaining]);

  function decide(value: boolean) {
    const claim = claims[index % claims.length];
    if (claim.answer === value) {
      streakRef.current += 1;
      bestRef.current = Math.max(bestRef.current, streakRef.current);
      onSetScore(bestRef.current);
    } else {
      streakRef.current = 0;
    }
    setIndex((current) => current + 1);
  }

  function onDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (Math.abs(info.offset.x) < 70) return;
    decide(info.offset.x > 0);
  }

  const claim = claims[index % claims.length];
  return (
    <section className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.1em] text-muted">
        <span>{copy.swipeHint}</span>
        <span>{copy.seconds.replace("{seconds}", String(Math.ceil(remaining / 1000)))}</span>
      </div>
      <div className="relative flex flex-1 items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={index}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={onDragEnd}
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            whileDrag={{ rotate: 5 }}
            className="w-full cursor-grab rounded-3xl border border-primary/20 bg-surface px-7 py-16 text-center shadow-lift active:cursor-grabbing"
          >
            <p className="font-display text-3xl leading-tight text-ink">{claim.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => decide(false)}
          className="min-h-14 rounded-2xl bg-blue-600 font-semibold tracking-wide text-white"
        >
          ← {copy.false}
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          className="min-h-14 rounded-2xl bg-red-500 font-semibold tracking-wide text-white"
        >
          {copy.true} →
        </button>
      </div>
    </section>
  );
}

function NumberRush({
  matchId,
  startAt,
  onSetScore,
  onFinish,
}: {
  matchId: string;
  startAt: number;
  onSetScore: (score: number) => void;
  onFinish: (score?: number) => void;
}) {
  const copy = tenantConfig.copy.duel;
  const secret = deterministicNumber(`${matchId}:${startAt}`, 100);
  const [value, setValue] = useState("");
  const [hint, setHint] = useState<"higher" | "lower" | null>(null);
  const [temperature, setTemperature] = useState("");
  const [done, setDone] = useState(false);

  function guess() {
    if (done) return;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 100) return;
    if (number === secret) {
      setDone(true);
      onSetScore(1);
      onFinish(1);
      return;
    }
    const distance = Math.abs(secret - number);
    setHint(number < secret ? "higher" : "lower");
    setTemperature(
      distance <= 5 ? copy.numberHot : distance <= 15 ? copy.numberWarm : copy.numberCold,
    );
    setValue("");
  }

  return (
    <section className="flex flex-1 flex-col justify-center">
      <p className="text-center text-sm font-medium tracking-wide text-muted">
        {copy.numberPrompt}
      </p>
      {hint ? (
        <motion.div
          key={`${hint}-${temperature}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`mt-8 text-center ${
            hint === "higher" ? "text-red-500" : "text-blue-500"
          }`}
        >
          <p className="font-display text-4xl">
            {hint === "higher" ? copy.numberHigher : copy.numberLower}
          </p>
          <p className="mt-2 text-sm font-medium tracking-wide">{temperature}</p>
        </motion.div>
      ) : null}
      <div className="mt-10 space-y-3">
        <input
          type="number"
          min={1}
          max={100}
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") guess();
          }}
          placeholder={copy.numberPlaceholder}
          className="field-input min-h-20 text-center font-display text-4xl"
        />
        <button type="button" onClick={guess} className="btn-primary w-full">
          {copy.numberSubmit}
        </button>
      </div>
    </section>
  );
}

function ResultScreen({
  localScore,
  opponentScore,
  rematchIncoming,
  onRematch,
  onExit,
}: {
  localScore: number;
  opponentScore: number;
  rematchIncoming: boolean;
  onRematch: () => void;
  onExit: () => void;
}) {
  const copy = tenantConfig.copy.duel;
  const won = localScore > opponentScore;
  const draw = localScore === opponentScore;
  return (
    <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden text-center">
      {won ? <Confetti /> : null}
      <motion.div
        initial={{ scale: 0.75, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-full"
      >
        <p className="text-6xl" aria-hidden>{won ? "🏆" : draw ? "🤝" : "✨"}</p>
        <h2 className="mt-5 font-display text-4xl leading-tight text-ink">
          {draw ? copy.draw : won ? copy.winner : copy.loser}
        </h2>
        <p className="mt-4 font-display text-2xl text-primary">
          {localScore} — {opponentScore}
        </p>
        {rematchIncoming ? (
          <p className="mt-3 animate-pulse text-sm font-medium tracking-wide text-muted">
            {copy.rematchIncoming}
          </p>
        ) : null}
        <div className="mt-10 space-y-3">
          <button type="button" onClick={onRematch} className="btn-primary w-full">
            {copy.rematch}
          </button>
          <button type="button" onClick={onExit} className="btn-secondary w-full">
            {copy.returnToTable}
          </button>
        </div>
      </motion.div>
    </section>
  );
}

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 24 }).map((_, index) => (
        <motion.span
          key={index}
          className="absolute left-1/2 top-1/3 size-2 rounded-sm bg-primary"
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{
            x: ((index % 8) - 3.5) * 42,
            y: 220 + (index % 5) * 24,
            rotate: 360 + index * 35,
            opacity: 0,
          }}
          transition={{ duration: 1.8, delay: (index % 6) * 0.04 }}
        />
      ))}
    </div>
  );
}

