"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ScrollText, Send, Trash2, Undo2, Volume2, VolumeX, X } from "lucide-react";
import { DrawCanvas } from "@/components/DrawCanvas";
import { tenantConfig } from "@/config/tenant.config";
import {
  DRAW_MAX_SNAPSHOT_STROKES,
  DRAW_MIN_PLAYERS,
  DRAW_PAINTER_BONUS,
  DRAW_PICK_MS,
  DRAW_REVEAL_MS,
  DRAW_TURN_MS,
  DRAW_WARN_MS,
  cafeDrawRoomId,
  electDrawHost,
  emptyDrawRound,
  guessPointsForIndex,
  isFuzzyMatch,
  kickThreshold,
  mergeStroke,
  nextPainterId,
  painterOrderOf,
  pickDrawWords,
  pinFromRoomId,
  withOccupantScores,
  type DrawChatMessage,
  type DrawOccupant,
  type DrawRoundState,
  type DrawStroke,
} from "@/lib/drawGame";
import { useDuelClock, type DuelPlayer } from "@/lib/duel";
import { getSupabase, wakeRealtime } from "@/lib/supabase";

type DrawRoomProps = {
  roomId: string;
  tenantId: string;
  player: DuelPlayer;
  onExit: () => void;
};

type GuessPayload = {
  clientId: string;
  nickname: string;
  avatar: string;
  text: string;
};

type HostApi = {
  chooseWord: (word: string) => void;
  applyGuess: (payload: GuessPayload) => void;
  applyVote: (targetId: string, fromId: string) => void;
};

type VoteTally = { targetId: string; votes: number; need: number };

export function DrawRoom({ roomId, tenantId, player, onExit }: DrawRoomProps) {
  const copy = tenantConfig.copy.duel.draw;
  const drawConfig = tenantConfig.duel.draw;
  const supabase = useMemo(() => getSupabase(), []);
  const [connected, setConnected] = useState(false);
  const [occupants, setOccupants] = useState<DrawOccupant[]>([]);
  const [round, setRound] = useState<DrawRoundState>(emptyDrawRound);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [chat, setChat] = useState<DrawChatMessage[]>([]);
  const [guess, setGuess] = useState("");
  const [color, setColor] = useState<string>(drawConfig.colors[0].hex);
  const [brush, setBrush] = useState<"thin" | "thick">("thin");
  const [muted, setMuted] = useState<string[]>([]);
  const [votePrompt, setVotePrompt] = useState<string | null>(null);
  const [voteTally, setVoteTally] = useState<VoteTally | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [socketEpoch, setSocketEpoch] = useState(0);
  const [logsOpen, setLogsOpen] = useState(false);
  const [lastWord, setLastWord] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(
    null,
  );
  const occupantsRef = useRef<DrawOccupant[]>([]);
  const roundRef = useRef<DrawRoundState>(emptyDrawRound());
  const strokesRef = useRef<DrawStroke[]>([]);
  const hostTimerRef = useRef<number | null>(null);
  const votesRef = useRef<Record<string, string[]>>({});
  const isHostRef = useRef(false);
  const hostApiRef = useRef<HostApi | null>(null);
  const onExitRef = useRef(onExit);
  const playerRef = useRef(player);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const chatListRef = useRef<HTMLUListElement | null>(null);
  const chatEndRef = useRef<HTMLLIElement | null>(null);
  const copyRef = useRef(copy);

  useEffect(() => {
    copyRef.current = copy;
  }, [copy]);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    wakeRealtime();
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const reconnectChannel = useCallback(() => {
    wakeRealtime();
    setSocketEpoch((value) => value + 1);
  }, []);

  useEffect(() => {
    occupantsRef.current = occupants;
  }, [occupants]);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const list = chatListRef.current;
      if (list) {
        list.scrollTop = list.scrollHeight;
        return;
      }
      chatEndRef.current?.scrollIntoView({ block: "end", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chat]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.overflow;
    const previousBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousHtml;
      body.style.overflow = previousBody;
    };
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!shell || !viewport) return;

    function syncViewport() {
      if (!shell || !viewport) return;
      shell.style.top = `${viewport.offsetTop}px`;
      shell.style.height = `${viewport.height}px`;
      shell.style.maxHeight = `${viewport.height}px`;
    }

    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel(roomId, {
      config: {
        broadcast: { self: false },
        presence: { key: player.clientId },
      },
    });

    function clearHostTimer() {
      if (hostTimerRef.current != null) {
        window.clearTimeout(hostTimerRef.current);
        hostTimerRef.current = null;
      }
    }

    function publishRound(next: DrawRoundState) {
      roundRef.current = next;
      setRound(next);
      void channel.send({
        type: "broadcast",
        event: "round_state",
        payload: next,
      });
    }

    function ingestChat(message: DrawChatMessage) {
      if (!message?.id || !message.clientId) return;
      setChat((current) => {
        const sameId = current.some((entry) => entry.id === message.id);
        if (sameId) return current;
        if (message.kind === "wrong" || message.kind === "correct") {
          const duplicate = current.some(
            (entry) =>
              entry.clientId === message.clientId &&
              entry.kind === message.kind &&
              (entry.text ?? "") === (message.text ?? ""),
          );
          if (duplicate) return current;
        }
        return [...current.slice(-40), message];
      });
    }

    function publishLog(message: DrawChatMessage) {
      ingestChat(message);
      void channel.send({
        type: "broadcast",
        event: "room_log",
        payload: message,
      });
    }

    function publishChat(message: DrawChatMessage) {
      ingestChat(message);
      void channel.send({
        type: "broadcast",
        event: "chat",
        payload: message,
      });
      void channel.send({
        type: "broadcast",
        event: "new_guess",
        payload: message,
      });
    }

    function showGuessToPainter(payload: GuessPayload) {
      if (roundRef.current.painterId !== player.clientId) return;
      if (payload.clientId === player.clientId) return;
      const current = roundRef.current;
      if (current.phase !== "draw") return;
      if (current.correctIds.includes(payload.clientId)) return;
      const correct =
        Boolean(current.word) && isFuzzyMatch(payload.text, current.word ?? "");
      ingestChat({
        id: `guess-${payload.clientId}-${payload.text}`,
        kind: correct ? "correct" : "wrong",
        clientId: payload.clientId,
        nickname: payload.nickname,
        avatar: payload.avatar,
        text: correct ? undefined : payload.text,
      });
    }

    function schedule(delay: number, action: () => void) {
      clearHostTimer();
      hostTimerRef.current = window.setTimeout(() => {
        hostTimerRef.current = null;
        if (!isHostRef.current) return;
        action();
      }, Math.max(0, delay));
    }

    function beginPick() {
      const people = occupantsRef.current;
      const scores = withOccupantScores(roundRef.current.scores, people);
      if (people.length < DRAW_MIN_PLAYERS) {
        clearHostTimer();
        publishRound({
          ...emptyDrawRound(),
          scores,
          round: roundRef.current.round,
        });
        return;
      }
      const order = painterOrderOf(people);
      const painterId = nextPainterId(
        order,
        roundRef.current.painterId,
        roundRef.current.painterOrder,
      );
      publishRound({
        phase: "pick",
        painterId,
        options: pickDrawWords(3),
        word: null,
        endsAt: Date.now() + DRAW_PICK_MS,
        scores,
        correctIds: [],
        round: roundRef.current.round + 1,
        painterOrder: order,
      });
      votesRef.current = {};
      setVoteTally(null);
      void channel.send({ type: "broadcast", event: "canvas_clear", payload: {} });
      setStrokes([]);
      strokesRef.current = [];
      schedule(DRAW_PICK_MS, autoPick);
    }

    function autoPick() {
      const current = roundRef.current;
      if (current.phase !== "pick") return;
      chooseWord(current.options[0] ?? "");
    }

    function chooseWord(word: string) {
      const current = roundRef.current;
      if (current.phase !== "pick" || !word) return;
      publishRound({
        ...current,
        phase: "warn",
        word,
        options: [],
        endsAt: Date.now() + DRAW_WARN_MS,
      });
      schedule(DRAW_WARN_MS, beginDraw);
    }

    function beginDraw() {
      const current = roundRef.current;
      if (current.phase !== "warn") return;
      publishRound({
        ...current,
        phase: "draw",
        endsAt: Date.now() + DRAW_TURN_MS,
      });
      schedule(DRAW_TURN_MS, beginReveal);
    }

    function beginReveal() {
      const current = roundRef.current;
      if (current.phase !== "draw") return;
      if (strokesRef.current.length === 0 && current.painterId) {
        const skipped =
          occupantsRef.current.find((entry) => entry.clientId === current.painterId) ??
          null;
        if (skipped) {
          publishLog({
            id: `skip-${current.painterId}-${Date.now()}`,
            kind: "skip",
            clientId: skipped.clientId,
            nickname: skipped.nickname,
            avatar: skipped.avatar,
          });
        }
      }
      const scores = { ...current.scores };
      if (current.painterId && current.correctIds.length > 0) {
        scores[current.painterId] =
          (scores[current.painterId] ?? 0) + DRAW_PAINTER_BONUS;
      }
      publishRound({
        ...current,
        phase: "reveal",
        scores,
        endsAt: Date.now() + DRAW_REVEAL_MS,
      });
      schedule(DRAW_REVEAL_MS, beginPick);
    }

    function maybeRevealEarly() {
      const current = roundRef.current;
      if (current.phase !== "draw" || !current.painterId) return;
      const guessers = occupantsRef.current.filter(
        (entry) => entry.clientId !== current.painterId,
      );
      if (
        guessers.length > 0 &&
        guessers.every((entry) => current.correctIds.includes(entry.clientId))
      ) {
        clearHostTimer();
        beginReveal();
      }
    }

    function applyGuess(payload: GuessPayload) {
      if (!isHostRef.current) return;
      const current = roundRef.current;
      const occupant = occupantsRef.current.find(
        (entry) => entry.clientId === payload.clientId,
      );
      if (!occupant) return;
      const correct =
        current.phase === "draw" &&
        current.word != null &&
        payload.clientId !== current.painterId &&
        !current.correctIds.includes(payload.clientId) &&
        isFuzzyMatch(payload.text, current.word);
      if (correct) {
        const points = guessPointsForIndex(current.correctIds.length);
        publishRound({
          ...current,
          correctIds: [...current.correctIds, payload.clientId],
          scores: {
            ...current.scores,
            [payload.clientId]: (current.scores[payload.clientId] ?? 0) + points,
          },
        });
        publishChat({
          id: `${payload.clientId}-${Date.now()}`,
          kind: "correct",
          clientId: payload.clientId,
          nickname: payload.nickname,
          avatar: payload.avatar,
        });
        maybeRevealEarly();
        return;
      }
      if (current.phase !== "draw") return;
      if (payload.clientId === current.painterId) return;
      if (current.correctIds.includes(payload.clientId)) return;
      publishChat({
        id: `${payload.clientId}-${Date.now()}`,
        kind: "wrong",
        clientId: payload.clientId,
        nickname: payload.nickname,
        avatar: payload.avatar,
        text: payload.text,
      });
    }

    function applyVote(targetId: string, fromId: string) {
      if (targetId === fromId) return;
      const previousVotes = votesRef.current[targetId] ?? [];
      const already = previousVotes.includes(fromId);
      const currentVotes = new Set(previousVotes);
      currentVotes.add(fromId);
      votesRef.current[targetId] = [...currentVotes];
      const need = kickThreshold(occupantsRef.current.length);
      const votes = currentVotes.size;
      setVoteTally({ targetId, votes, need });
      if (!already) {
        const from = occupantsRef.current.find((entry) => entry.clientId === fromId);
        const target = occupantsRef.current.find((entry) => entry.clientId === targetId);
        if (from && target) {
          ingestChat({
            id: `vote-${fromId}-${targetId}-${Date.now()}`,
            kind: "vote",
            clientId: from.clientId,
            nickname: from.nickname,
            avatar: from.avatar,
            targetId: target.clientId,
            targetName: target.nickname,
          });
        }
      }
      if (isHostRef.current && votes >= need) {
        const kicked = occupantsRef.current.find((entry) => entry.clientId === targetId);
        if (kicked) {
          publishLog({
            id: `kicked-${targetId}-${Date.now()}`,
            kind: "leave",
            clientId: kicked.clientId,
            nickname: kicked.nickname,
            avatar: kicked.avatar,
            text: "kicked",
          });
        }
        void channel.send({
          type: "broadcast",
          event: "kicked",
          payload: { clientId: targetId },
        });
        if (targetId === player.clientId) {
          setNotice(copyRef.current.kicked);
          window.setTimeout(() => onExitRef.current(), 1400);
        }
      }
    }

    function refreshHost() {
      const ids = occupantsRef.current.map((entry) => entry.clientId);
      const hostId = electDrawHost(ids);
      const nowHost = hostId === player.clientId;
      const wasHost = isHostRef.current;
      isHostRef.current = nowHost;
      if (!nowHost) {
        clearHostTimer();
        return;
      }
      if (wasHost) return;
      const current = roundRef.current;
      if (current.phase === "lobby") return;
      const remaining = current.endsAt - Date.now();
      if (remaining <= 0) {
        if (current.phase === "pick") autoPick();
        else if (current.phase === "warn") beginDraw();
        else if (current.phase === "draw") beginReveal();
        else beginPick();
        return;
      }
      if (current.phase === "pick") schedule(remaining, autoPick);
      if (current.phase === "warn") schedule(remaining, beginDraw);
      if (current.phase === "draw") schedule(remaining, beginReveal);
      if (current.phase === "reveal") schedule(remaining, beginPick);
    }

    hostApiRef.current = { chooseWord, applyGuess, applyVote };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<DrawOccupant>();
        const previous = occupantsRef.current;
        const previousIds = new Set(previous.map((entry) => entry.clientId));
        const next: DrawOccupant[] = [];
        const seen = new Set<string>();
        for (const entry of Object.values(state).flat()) {
          if (!entry.clientId || seen.has(entry.clientId)) continue;
          seen.add(entry.clientId);
          next.push({
            clientId: entry.clientId,
            nickname: entry.nickname,
            avatar: entry.avatar,
          });
        }
        occupantsRef.current = next;
        setOccupants(next);

        if (previousIds.size > 0) {
          for (const person of next) {
            if (previousIds.has(person.clientId)) continue;
            ingestChat({
              id: `join-${person.clientId}-${Date.now()}`,
              kind: "join",
              clientId: person.clientId,
              nickname: person.nickname,
              avatar: person.avatar,
            });
          }
          for (const person of previous) {
            if (next.some((entry) => entry.clientId === person.clientId)) continue;
            ingestChat({
              id: `leave-${person.clientId}-${Date.now()}`,
              kind: "leave",
              clientId: person.clientId,
              nickname: person.nickname,
              avatar: person.avatar,
            });
          }
        }

        refreshHost();
        if (!isHostRef.current) return;

        const painterGone =
          roundRef.current.painterId != null &&
          !next.some((entry) => entry.clientId === roundRef.current.painterId);
        if (next.length < DRAW_MIN_PLAYERS && roundRef.current.phase !== "lobby") {
          beginPick();
        } else if (roundRef.current.phase === "lobby" && next.length >= DRAW_MIN_PLAYERS) {
          beginPick();
        } else if (painterGone && roundRef.current.phase !== "lobby") {
          clearHostTimer();
          beginPick();
        }

        const joined = next.some((entry) => !previousIds.has(entry.clientId));
        if (joined) {
          void channel.send({
            type: "broadcast",
            event: "canvas_snapshot",
            payload: {
              strokes: strokesRef.current.slice(-DRAW_MAX_SNAPSHOT_STROKES),
              round: roundRef.current,
            },
          });
        }
      })
      .on("broadcast", { event: "round_state" }, ({ payload }) => {
        const next = payload as DrawRoundState;
        roundRef.current = next;
        setRound(next);
        if (next.phase === "pick" || next.phase === "warn") {
          setStrokes([]);
          strokesRef.current = [];
        }
      })
      .on("broadcast", { event: "draw_stroke" }, ({ payload }) => {
        const stroke = payload as DrawStroke;
        if (!stroke?.id || !Array.isArray(stroke.points)) return;
        setStrokes((current) => {
          const next = mergeStroke(current, {
            ...stroke,
            seq: stroke.seq ?? 0,
          });
          strokesRef.current = next;
          return next;
        });
      })
      .on("broadcast", { event: "canvas_clear" }, () => {
        strokesRef.current = [];
        setStrokes([]);
      })
      .on("broadcast", { event: "canvas_undo" }, () => {
        setStrokes((current) => {
          const next = current.slice(0, -1);
          strokesRef.current = next;
          return next;
        });
      })
      .on("broadcast", { event: "canvas_snapshot" }, ({ payload }) => {
        const snapshot = payload as { strokes?: DrawStroke[]; round?: DrawRoundState };
        if (Array.isArray(snapshot.strokes) && strokesRef.current.length === 0) {
          const restored = snapshot.strokes.map((stroke) => ({
            ...stroke,
            seq: stroke.seq ?? 0,
          }));
          strokesRef.current = restored;
          setStrokes(restored);
        }
        if (snapshot.round && roundRef.current.phase === "lobby") {
          roundRef.current = snapshot.round;
          setRound(snapshot.round);
        }
      })
      .on("broadcast", { event: "pick_word" }, ({ payload }) => {
        const request = payload as { playerId?: string; word?: string };
        const current = roundRef.current;
        if (
          current.phase !== "pick" ||
          request.playerId !== current.painterId ||
          !request.word ||
          !current.options.includes(request.word)
        ) {
          return;
        }
        if (!isHostRef.current) return;
        clearHostTimer();
        chooseWord(request.word);
      })
      .on("broadcast", { event: "guess" }, ({ payload }) => {
        const nextGuess = payload as GuessPayload;
        showGuessToPainter(nextGuess);
        applyGuess(nextGuess);
      })
      .on("broadcast", { event: "new_guess" }, ({ payload }) => {
        ingestChat(payload as DrawChatMessage);
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        ingestChat(payload as DrawChatMessage);
      })
      .on("broadcast", { event: "room_log" }, ({ payload }) => {
        ingestChat(payload as DrawChatMessage);
      })
      .on("broadcast", { event: "vote_kick" }, ({ payload }) => {
        const vote = payload as { targetId: string; fromId: string };
        applyVote(vote.targetId, vote.fromId);
      })
      .on("broadcast", { event: "kicked" }, ({ payload }) => {
        const kicked = payload as { clientId: string };
        if (kicked.clientId === player.clientId) {
          setNotice(copyRef.current.kicked);
          window.setTimeout(() => onExitRef.current(), 1400);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          const current = playerRef.current;
          void channel.track({
            clientId: current.clientId,
            nickname: current.nickname,
            avatar: current.avatar,
          });
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    channelRef.current = channel;
    return () => {
      clearHostTimer();
      hostApiRef.current = null;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [player.clientId, roomId, socketEpoch, supabase]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") return;
      const channel = channelRef.current;
      if (!channel || channel.state !== "joined") {
        reconnectChannel();
        return;
      }
      wakeRealtime();
      const current = playerRef.current;
      void channel.track({
        clientId: current.clientId,
        nickname: current.nickname,
        avatar: current.avatar,
      });
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        reconnectChannel();
        return;
      }
      handleVisibility();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    window.addEventListener("online", handleVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
      window.removeEventListener("online", handleVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [reconnectChannel]);

  useEffect(() => {
    if (!connected) return;
    void channelRef.current?.track({
      clientId: player.clientId,
      nickname: player.nickname,
      avatar: player.avatar,
    });
  }, [connected, player.avatar, player.clientId, player.nickname]);

  const brushWidth =
    brush === "thin" ? drawConfig.brushes.thin : drawConfig.brushes.thick;
  const painter =
    occupants.find((entry) => entry.clientId === round.painterId) ?? null;
  const isPainter = round.painterId === player.clientId;
  const alreadyCorrect = round.correctIds.includes(player.clientId);
  const now = useDuelClock(100);
  const remaining = now && round.endsAt ? Math.max(0, round.endsAt - now) : 0;
  const pin = pinFromRoomId(roomId);
  const isCafe = roomId === cafeDrawRoomId(tenantId);

  const ranked = [...occupants].sort(
    (a, b) => (round.scores[b.clientId] ?? 0) - (round.scores[a.clientId] ?? 0),
  );

  function onStroke(stroke: DrawStroke) {
    setStrokes((current) => {
      const next = mergeStroke(current, stroke);
      strokesRef.current = next;
      return next;
    });
    send("draw_stroke", stroke);
  }

  function clearBoard() {
    strokesRef.current = [];
    setStrokes([]);
    send("canvas_clear", {});
  }

  function undoBoard() {
    setStrokes((current) => {
      const next = current.slice(0, -1);
      strokesRef.current = next;
      return next;
    });
    send("canvas_undo", {});
  }

  function submitGuess() {
    const text = guess.trim();
    if (!text || isPainter || alreadyCorrect || round.phase !== "draw") return;
    const payload: GuessPayload = {
      clientId: player.clientId,
      nickname: player.nickname,
      avatar: player.avatar,
      text,
    };
    setGuess("");
    send("guess", payload);
    if (isHostRef.current) hostApiRef.current?.applyGuess(payload);
  }

  function pickWord(word: string) {
    if (isHostRef.current) {
      hostApiRef.current?.chooseWord(word);
      return;
    }
    send("pick_word", { playerId: player.clientId, word });
  }

  function voteKick(targetId: string) {
    hostApiRef.current?.applyVote(targetId, player.clientId);
    send("vote_kick", { targetId, fromId: player.clientId });
    setVotePrompt(null);
  }

  function toggleMute(clientId: string) {
    setMuted((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId],
    );
  }

  const totalMs =
    round.phase === "pick"
      ? DRAW_PICK_MS
      : round.phase === "warn"
        ? DRAW_WARN_MS
        : round.phase === "draw"
          ? DRAW_TURN_MS
          : round.phase === "reveal"
            ? DRAW_REVEAL_MS
            : 1;

  const skippedTurn = round.phase === "reveal" && strokes.length === 0;
  const nobodyGuessed = round.phase === "reveal" && round.correctIds.length === 0;
  const showChrome = connected && round.phase !== "lobby";
  const answers = chat.filter(
    (message) =>
      message.kind === "wrong" ||
      message.kind === "correct" ||
      message.kind === "vote" ||
      message.kind === "skip",
  );
  const logs = chat.filter(
    (message) =>
      message.kind === "vote" ||
      message.kind === "join" ||
      message.kind === "leave" ||
      message.kind === "skip" ||
      message.kind === "system",
  );

  useEffect(() => {
    if (round.phase === "reveal" && round.word) setLastWord(round.word);
  }, [round.phase, round.word]);

  return (
    <div
      ref={shellRef}
      className="fixed inset-x-0 top-0 z-[80] flex h-[100dvh] max-h-[100dvh] justify-center overflow-hidden bg-background"
    >
      <div className="relative flex h-full max-h-full w-full max-w-md select-none flex-col overflow-hidden bg-background">
        <div className="shrink-0 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <header className="flex h-11 max-h-[55px] items-center gap-2 px-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                {isCafe ? copy.publicRoomBadge : copy.roomCode.replace("{pin}", pin ?? "")}
              </p>
              <p className="truncate font-display text-sm leading-tight text-ink">
                {copy.title}
                {painter && round.phase !== "lobby"
                  ? ` · ${painter.avatar} ${painter.nickname}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onExit}
              aria-label={copy.leave}
              className="flex size-9 items-center justify-center rounded-full bg-surface text-ink"
            >
              <X className="size-4" />
            </button>
          </header>
          {round.phase !== "lobby" ? (
            <div className="mx-3 h-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-100"
                style={{ width: `${Math.min(100, (remaining / totalMs) * 100)}%` }}
              />
            </div>
          ) : null}
        </div>

        <main className="flex min-h-0 flex-1 flex-col px-2 pt-1.5">
          {!connected ? (
            <WaitPulse title={supabase ? copy.connecting : copy.unavailable} />
          ) : round.phase === "lobby" ? (
            <div className="m-auto w-full px-2 text-center">
              <span className="draw-wait-icon text-5xl" aria-hidden>
                ☕
              </span>
              {!isCafe && pin ? (
                <>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                    {copy.sharePin}
                  </p>
                  <p className="mt-2 font-display text-5xl tracking-[0.22em] text-ink">
                    {pin}
                  </p>
                </>
              ) : (
                <p className="mt-4 font-display text-2xl text-ink">{copy.publicRoomBadge}</p>
              )}
              <p className="mt-4 text-sm font-medium tracking-wide text-muted">
                {copy.waitingPlayers}
              </p>
              <p className="mt-2 text-xs font-medium tracking-wide text-muted">
                {copy.insideCount.replace("{count}", String(occupants.length))}
              </p>
            </div>
          ) : (
            <>
              <section className="relative flex min-h-0 flex-[1.45] flex-col overflow-hidden rounded-2xl bg-white">
                {isPainter && round.phase === "draw" ? (
                  <p className="pointer-events-none absolute left-2 right-2 top-2 z-10 truncate rounded-xl bg-primary/90 px-3 py-1 text-center text-[11px] font-medium text-on-primary">
                    {copy.secretWord.replace("{word}", round.word ?? "")}
                  </p>
                ) : null}
                {round.phase === "pick" && isPainter ? (
                  <div className="m-auto grid w-full max-w-sm gap-2 px-3">
                    <p className="text-center font-display text-xl text-ink">{copy.pickTitle}</p>
                    {round.options.map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => pickWord(word)}
                        className="btn-secondary min-h-12"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                ) : round.phase === "pick" ? (
                  <NextPainterCard
                    painter={painter}
                    title={copy.nextTurn}
                    label={copy.nextPainterLabel}
                    lastWord={
                      lastWord
                        ? copy.previousWord.replace("{word}", lastWord)
                        : undefined
                    }
                  />
                ) : round.phase === "warn" && isPainter ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="m-auto px-6 text-center"
                  >
                    <p className="font-display text-2xl leading-snug text-ink">{copy.warnTitle}</p>
                  </motion.div>
                ) : round.phase === "reveal" ? (
                  <IntermissionStage
                    skipped={skippedTurn}
                    nobodyGuessed={nobodyGuessed}
                    painterName={painter?.nickname ?? ""}
                    word={round.word ?? ""}
                    guessedCount={round.correctIds.length}
                    copy={copy}
                  />
                ) : (
                  <div className="absolute inset-0">
                    <DrawCanvas
                      strokes={strokes}
                      color={color}
                      width={brushWidth}
                      interactive={isPainter && round.phase === "draw"}
                      onStroke={onStroke}
                    />
                  </div>
                )}
                {isPainter && round.phase === "draw" ? (
                  <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-2 rounded-xl bg-background/90 px-3 py-1.5 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      {drawConfig.colors.map((swatch) => (
                        <button
                          key={swatch.id}
                          type="button"
                          aria-label={swatch.id}
                          onClick={() => setColor(swatch.hex)}
                          className={`size-6 rounded-full border-2 ${
                            color === swatch.hex ? "border-ink" : "border-transparent"
                          }`}
                          style={{ background: swatch.hex }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBrush("thin")}
                        aria-label={copy.thinBrush}
                        className={`flex size-7 items-center justify-center rounded-full ${
                          brush === "thin" ? "bg-primary" : "bg-surface"
                        }`}
                      >
                        <span
                          className={`block size-1.5 rounded-full ${
                            brush === "thin" ? "bg-on-primary" : "bg-ink"
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrush("thick")}
                        aria-label={copy.thickBrush}
                        className={`flex size-7 items-center justify-center rounded-full ${
                          brush === "thick" ? "bg-primary" : "bg-surface"
                        }`}
                      >
                        <span
                          className={`block size-2.5 rounded-full ${
                            brush === "thick" ? "bg-on-primary" : "bg-ink"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={undoBoard}
                        aria-label={copy.undo}
                        className="flex size-8 items-center justify-center rounded-full bg-surface"
                      >
                        <Undo2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={clearBoard}
                        aria-label={copy.clear}
                        className="flex size-8 items-center justify-center rounded-full bg-surface"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              {showChrome ? (
                <div className="mt-1.5 flex min-h-[10.5rem] flex-1 gap-1.5 pb-safe">
                  <aside className="w-[7.25rem] shrink-0 overflow-y-auto rounded-2xl bg-surface/80">
                    {ranked.map((entry) => {
                      const guessed = round.correctIds.includes(entry.clientId);
                      const drawing = round.painterId === entry.clientId;
                      return (
                        <button
                          key={entry.clientId}
                          type="button"
                          onClick={() => {
                            if (entry.clientId === player.clientId) return;
                            setVotePrompt(entry.clientId);
                          }}
                          className={`flex w-full items-center gap-1.5 border-b border-primary/10 px-1.5 py-1.5 text-left ${
                            drawing ? "bg-primary/10" : ""
                          }`}
                        >
                          <span className="relative text-lg leading-none">
                            {entry.avatar}
                            {guessed ? (
                              <span className="absolute -bottom-0.5 -right-0.5 text-[9px] text-emerald-600">
                                ✓
                              </span>
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[10px] font-medium text-ink">
                              {entry.nickname}
                            </span>
                            <span className="block text-[9px] text-muted">
                              {round.scores[entry.clientId] ?? 0}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </aside>
                  <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface/80">
                    <div className="flex shrink-0 items-center gap-1 px-2 pt-1.5">
                      {!isPainter ? (
                        <button
                          type="button"
                          onClick={() => setVotePrompt(round.painterId)}
                          aria-label={copy.voteKick}
                          className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary"
                        >
                          <AlertTriangle className="size-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setLogsOpen(true)}
                        aria-label={copy.openLogs}
                        className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary"
                      >
                        <ScrollText className="size-3.5" />
                      </button>
                      <p className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                        {copy.answersTab}
                      </p>
                    </div>
                    <ul
                      ref={chatListRef}
                      className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-1"
                    >
                      {lastWord && round.phase !== "reveal" ? (
                        <li className="text-[11px] font-medium text-primary">
                          {copy.previousWord.replace("{word}", lastWord)}
                        </li>
                      ) : null}
                      {painter && round.phase === "pick" ? (
                        <li className="text-[11px] font-medium text-ink">
                          {copy.turnOf.replace("{nickname}", painter.nickname)}
                        </li>
                      ) : null}
                      {answers.map((message) => {
                        const isMuted = muted.includes(message.clientId);
                        return (
                          <li
                            key={message.id}
                            className={`flex items-start justify-between gap-1 text-[11px] leading-snug ${
                              message.kind === "correct"
                                ? "font-medium text-emerald-700"
                                : message.kind === "vote" || message.kind === "skip"
                                  ? "font-medium text-red-700"
                                  : "text-ink"
                            }`}
                          >
                            <span className={isMuted ? "italic text-muted" : undefined}>
                              {isMuted
                                ? message.nickname
                                : feedText(message, copy)}
                            </span>
                            {message.clientId !== player.clientId &&
                            message.kind !== "vote" &&
                            message.kind !== "skip" ? (
                              <button
                                type="button"
                                onClick={() => toggleMute(message.clientId)}
                                aria-label={isMuted ? copy.unmute : copy.mute}
                                className="shrink-0 text-muted"
                              >
                                {isMuted ? (
                                  <VolumeX className="size-3" />
                                ) : (
                                  <Volume2 className="size-3" />
                                )}
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                      <li ref={chatEndRef} aria-hidden className="h-px" />
                    </ul>
                    {isPainter ? (
                      <p className="shrink-0 px-2 py-2 text-center text-[11px] font-medium text-muted">
                        {copy.waitingGuesses}
                      </p>
                    ) : alreadyCorrect ? (
                      <p className="shrink-0 px-2 py-2 text-center text-[11px] font-medium text-emerald-700">
                        {copy.lockedGuess}
                      </p>
                    ) : round.phase === "draw" ? (
                      <form
                        className="flex shrink-0 gap-1.5 border-t border-primary/10 p-1.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitGuess();
                        }}
                      >
                        <input
                          value={guess}
                          onChange={(event) => setGuess(event.target.value)}
                          placeholder={copy.guessPlaceholder}
                          className="field-input min-h-10 flex-1 text-sm"
                        />
                        <button
                          type="submit"
                          aria-label={copy.guessSend}
                          className="btn-primary min-h-10 px-3"
                        >
                          <Send className="size-4" />
                        </button>
                      </form>
                    ) : (
                      <p className="shrink-0 px-2 py-2 text-center text-[11px] font-medium text-muted">
                        {round.phase === "reveal" ? copy.intermission : copy.drawingWait}
                      </p>
                    )}
                  </section>
                </div>
              ) : null}
            </>
          )}
        </main>

        {logsOpen ? (
          <div className="absolute inset-0 z-20 flex flex-col bg-ink/80 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-safe">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-xl text-background">{copy.logsTab}</p>
              <button
                type="button"
                onClick={() => setLogsOpen(false)}
                aria-label={copy.closeLogs}
                className="flex size-9 items-center justify-center rounded-full bg-background/15 text-background"
              >
                <X className="size-4" />
              </button>
            </div>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {logs.length === 0 ? (
                <li className="text-sm text-background/70">{copy.logsTab}</li>
              ) : (
                logs.map((message) => (
                  <li
                    key={message.id}
                    className={`text-sm ${
                      message.kind === "vote" || message.kind === "skip"
                        ? "text-red-300"
                        : "text-background"
                    }`}
                  >
                    {feedText(message, copy)}
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}

        {votePrompt ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/50 px-6">
            <div className="w-full max-w-xs rounded-2xl bg-background p-5 text-center">
              <p className="text-sm font-medium text-ink">{copy.voteKick}</p>
              {voteTally && voteTally.targetId === votePrompt ? (
                <p className="mt-2 text-xs text-muted">
                  {copy.voteProgress
                    .replace("{votes}", String(voteTally.votes))
                    .replace("{need}", String(voteTally.need))}
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVotePrompt(null)}
                  className="btn-secondary min-h-11 text-sm"
                >
                  {copy.voteNo}
                </button>
                <button
                  type="button"
                  onClick={() => voteKick(votePrompt)}
                  className="btn-primary min-h-11 text-sm"
                >
                  {copy.voteYes}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {notice ? (
          <p className="pointer-events-none absolute inset-x-6 bottom-8 rounded-2xl bg-ink px-4 py-3 text-center text-sm text-background">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function WaitPulse({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="m-auto flex flex-col items-center px-4 text-center">
      <span className="draw-wait-icon text-5xl" aria-hidden>
        ☕
      </span>
      <p className="mt-4 font-display text-xl leading-snug text-ink">{title}</p>
      {detail ? (
        <p className="mt-2 text-sm font-medium tracking-wide text-muted">{detail}</p>
      ) : null}
    </div>
  );
}

function NextPainterCard({
  painter,
  title,
  label,
  lastWord,
}: {
  painter: { avatar: string; nickname: string } | null;
  title: string;
  label: string;
  lastWord?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="m-auto flex flex-col items-center px-4 text-center"
    >
      <p className="font-display text-2xl text-ink">{title}</p>
      <p className="mt-4 text-5xl" aria-hidden>
        {painter?.avatar ?? "☕"}
      </p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="font-display text-2xl text-ink">{painter?.nickname ?? ""}</p>
      {lastWord ? (
        <p className="mt-3 text-xs font-medium text-primary">{lastWord}</p>
      ) : null}
    </motion.div>
  );
}

function IntermissionStage({
  skipped,
  nobodyGuessed,
  painterName,
  word,
  guessedCount,
  copy,
}: {
  skipped: boolean;
  nobodyGuessed: boolean;
  painterName: string;
  word: string;
  guessedCount: number;
  copy: typeof tenantConfig.copy.duel.draw;
}) {
  const sad = skipped || nobodyGuessed;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="m-auto flex flex-col items-center px-4 text-center"
    >
      <p className="font-display text-2xl text-ink">
        {skipped ? copy.skippedTitle : copy.intermission}
      </p>
      <span
        className={`${sad ? "draw-sad-icon" : "draw-wait-icon"} mt-3 text-5xl`}
        aria-hidden
      >
        {sad ? "😢☕" : "☕"}
      </span>
      <p className="mt-3 text-sm font-medium text-muted">
        {skipped
          ? copy.skippedLead.replace("{nickname}", painterName)
          : copy.restLead}
      </p>
      <p className="mt-2 font-display text-2xl text-ink">
        {copy.wordReveal.replace("{word}", word)}
      </p>
      {!skipped ? (
        <p className="mt-1 text-xs font-medium text-muted">
          {nobodyGuessed
            ? copy.nobodyGuessed
            : copy.guessedCount.replace("{count}", String(guessedCount))}
        </p>
      ) : null}
    </motion.div>
  );
}

function feedText(
  message: DrawChatMessage,
  copy: typeof tenantConfig.copy.duel.draw,
) {
  if (message.kind === "correct") {
    return copy.correctBanner.replace("{nickname}", message.nickname);
  }
  if (message.kind === "vote") {
    return copy.logVote
      .replace("{from}", message.nickname)
      .replace("{target}", message.targetName ?? "");
  }
  if (message.kind === "skip") {
    return copy.logSkip.replace("{nickname}", message.nickname);
  }
  if (message.kind === "join") {
    return copy.logJoined.replace("{nickname}", message.nickname);
  }
  if (message.kind === "leave") {
    return message.text === "kicked"
      ? copy.logKicked.replace("{nickname}", message.nickname)
      : copy.logLeft.replace("{nickname}", message.nickname);
  }
  return `${message.avatar} ${message.nickname}: ${message.text ?? ""}`;
}
