"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Swords } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { DrawRoom } from "@/components/DrawRoom";
import { DuelMatchContainer } from "@/components/DuelMatchContainer";
import { tenantConfig, type DuelGameId } from "@/config/tenant.config";
import {
  CHALLENGE_TIMEOUT_MS,
  clearPersistedMatch,
  enabledGameIds,
  generateIdentity,
  persistActiveMatch,
  persistIdentity,
  readOrCreateClientId,
  readOrCreateIdentity,
  readPersistedMatch,
  makeMatchId,
  resolveGameForMatch,
  type ChallengeAcceptPayload,
  type ChallengeCancelPayload,
  type ChallengeDeclinePayload,
  type ChallengeRequestPayload,
  type DuelIdentity,
  type DuelMatch,
  type DuelPlayer,
  type SelectedGame,
} from "@/lib/duel";
import { getSupabase, isRealtimeJoined, wakeRealtime } from "@/lib/supabase";
import { useCampaign } from "@/lib/useCampaign";

type OutgoingChallenge = {
  matchId: string;
  target: DuelPlayer;
  gameId: DuelGameId;
  expiresAt: number;
};

type IncomingChallenge = {
  matchId: string;
  from: DuelPlayer;
  gameId: DuelGameId;
  expiresAt: number;
};

type DuelContextValue = {
  tenantId: string;
  ready: boolean;
  enabledGames: DuelGameId[];
  identity: DuelIdentity;
  rerollIdentity: () => void;
  chooseIdentity: (identity: DuelIdentity) => void;
  peers: DuelPlayer[];
  connected: boolean;
  connectionError: boolean;
  player: DuelPlayer;
  selectedGame: SelectedGame;
  setSelectedGame: (game: SelectedGame) => void;
  sendChallenge: (target: DuelPlayer) => void;
  inMatch: boolean;
  inDrawRoom: boolean;
  match: DuelMatch | null;
  drawRoomId: string | null;
  exitMatch: () => void;
  joinDrawRoom: (roomId: string) => void;
  leaveDrawRoom: () => void;
};

const DuelContext = createContext<DuelContextValue | null>(null);

export function useDuel(): DuelContextValue {
  const ctx = useContext(DuelContext);
  if (!ctx) {
    throw new Error("useDuel must be used within a DuelProvider");
  }
  return ctx;
}

export function DuelStage() {
  const { tenantId, player, match, drawRoomId, exitMatch, leaveDrawRoom } =
    useDuel();
  return (
    <>
      {match ? (
        <DuelMatchContainer
          tenantId={tenantId}
          match={match}
          player={player}
          onExit={exitMatch}
        />
      ) : null}
      {drawRoomId ? (
        <DrawRoom
          roomId={drawRoomId}
          tenantId={tenantId}
          player={player}
          onExit={leaveDrawRoom}
        />
      ) : null}
    </>
  );
}

export function DuelProvider({
  tenantId,
  children,
}: {
  tenantId: string;
  children: ReactNode;
}) {
  const copy = tenantConfig.copy.duel;
  const campaign = useCampaign();
  const enabled = useMemo(
    () => enabledGameIds(campaign.enabledGames),
    [campaign.enabledGames],
  );
  const supabase = useMemo(() => getSupabase(), []);
  // Named explicitly: this is the single, long-lived lobby presence channel.
  // It must never be torn down/recreated just because the player's nickname
  // or avatar changes (see the dedicated dependency array below).
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null);
  const playerRef = useRef<DuelPlayer | null>(null);
  const outgoingRef = useRef<OutgoingChallenge | null>(null);
  const incomingRef = useRef<IncomingChallenge | null>(null);

  const [clientId] = useState(readOrCreateClientId);
  const [identity, setIdentity] = useState<DuelIdentity>(readOrCreateIdentity);
  const [peers, setPeers] = useState<DuelPlayer[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(() => supabase == null);
  const [selectedGame, setSelectedGame] = useState<SelectedGame>(
    () => enabled[0] ?? "random",
  );
  const [outgoingChallenge, setOutgoingChallenge] =
    useState<OutgoingChallenge | null>(null);
  const [incomingChallenge, setIncomingChallenge] =
    useState<IncomingChallenge | null>(null);
  const [outgoingNotice, setOutgoingNotice] = useState<string | null>(null);
  // Restored from sessionStorage when present, so a page refresh mid-match can
  // attempt to rejoin the same match room instead of losing the game.
  const [match, setMatch] = useState<DuelMatch | null>(readPersistedMatch);
  const [drawRoomId, setDrawRoomId] = useState<string | null>(null);

  const setActiveMatch = useCallback((next: DuelMatch | null) => {
    if (next) {
      persistActiveMatch(next);
    } else {
      clearPersistedMatch();
    }
    setMatch(next);
  }, []);

  useEffect(() => {
    outgoingRef.current = outgoingChallenge;
  }, [outgoingChallenge]);

  useEffect(() => {
    incomingRef.current = incomingChallenge;
  }, [incomingChallenge]);

  // Pending invitations are still a lobby state. Marking them as in_game made
  // both players disappear from the idle presence list until the invite ended.
  const busy = match != null || drawRoomId != null;

  const player = useMemo<DuelPlayer>(
    () => ({
      clientId,
      nickname: identity.nickname,
      avatar: identity.avatar,
      games: enabled,
      status: busy ? "in_game" : "idle",
      onlineAt: new Date().toISOString(),
    }),
    [busy, clientId, enabled, identity],
  );

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    let joining = false;
    let retryTimer: number | null = null;
    let channel: RealtimeChannel | null = null;

    function clearRetry() {
      if (retryTimer != null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    function bind(next: RealtimeChannel) {
      next
        .on("presence", { event: "sync" }, () => {
          const state = next.presenceState<DuelPlayer>();
          const syncedPlayers = new Map<string, DuelPlayer>();
          for (const entry of Object.values(state).flat()) {
            if (entry.clientId === clientId || entry.status !== "idle") continue;
            // A reconnect can briefly expose multiple presence metas for the same
            // key. The sync snapshot remains the only source of truth; deduping it
            // prevents duplicate/ghost rows without manually removing players.
            syncedPlayers.set(entry.clientId, {
              clientId: entry.clientId,
              nickname: entry.nickname,
              avatar: entry.avatar,
              games: entry.games,
              status: entry.status,
              onlineAt: entry.onlineAt,
            });
          }
          setPeers(Array.from(syncedPlayers.values()));
        })
        .on("broadcast", { event: "challenge_request" }, ({ payload }) => {
          const request = payload as ChallengeRequestPayload;
          const current = playerRef.current;
          if (!current || request.targetId !== current.clientId) return;
          if (current.status !== "idle") return;
          if (incomingRef.current || outgoingRef.current) return;
          const nextChallenge: IncomingChallenge = {
            matchId: request.matchId,
            from: request.from,
            gameId: request.gameId,
            expiresAt: Date.now() + CHALLENGE_TIMEOUT_MS,
          };
          incomingRef.current = nextChallenge;
          setIncomingChallenge(nextChallenge);
        })
        .on("broadcast", { event: "challenge_cancelled" }, ({ payload }) => {
          const cancel = payload as ChallengeCancelPayload;
          if (cancel.targetId !== clientId) return;
          const current = incomingRef.current;
          if (!current || current.from.clientId !== cancel.challengerId) return;
          incomingRef.current = null;
          setIncomingChallenge(null);
          setOutgoingNotice(
            copy.challengeCancelledNotice.replace(
              "{nickname}",
              current.from.nickname,
            ),
          );
        })
        .on("broadcast", { event: "challenge_accept" }, ({ payload }) => {
          const accept = payload as ChallengeAcceptPayload;
          if (accept.targetId !== clientId) return;
          const current = outgoingRef.current;
          if (!current || current.matchId !== accept.matchId) return;
          outgoingRef.current = null;
          setOutgoingChallenge(null);
          setActiveMatch({ id: accept.matchId, gameId: current.gameId, opponent: accept.by });
        })
        .on("broadcast", { event: "challenge_declined" }, ({ payload }) => {
          const decline = payload as ChallengeDeclinePayload;
          if (decline.targetId !== clientId) return;
          const current = outgoingRef.current;
          if (!current || current.matchId !== decline.matchId) return;
          outgoingRef.current = null;
          setOutgoingChallenge(null);
          setOutgoingNotice(
            decline.reason === "declined"
              ? copy.challengeDeclinedNotice
              : copy.challengeExpired,
          );
        })
        .subscribe(async (status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            clearRetry();
            setConnected(true);
            setConnectionError(false);
            if (playerRef.current) await next.track(playerRef.current);
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnected(false);
            setConnectionError(true);
            scheduleRejoin();
            return;
          }
          if (status === "CLOSED") {
            setConnected(false);
            scheduleRejoin();
          }
        });
    }

    function scheduleRejoin() {
      if (cancelled || document.visibilityState === "hidden") return;
      clearRetry();
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void rejoin();
      }, 500);
    }

    async function rejoin() {
      if (cancelled || joining) return;
      joining = true;
      wakeRealtime();
      const previous = channel;
      channel = null;
      lobbyChannelRef.current = null;
      if (previous) await client.removeChannel(previous);
      if (cancelled) {
        joining = false;
        return;
      }
      const next = client.channel(`tenant_${tenantId}_lobby`, {
        config: {
          presence: { key: clientId },
          broadcast: { self: false },
        },
      });
      channel = next;
      lobbyChannelRef.current = next;
      bind(next);
      joining = false;
    }

    function resume() {
      if (cancelled) return;
      if (document.visibilityState === "hidden") return;
      wakeRealtime();
      if (isRealtimeJoined(channel)) {
        if (playerRef.current) void channel?.track(playerRef.current);
        return;
      }
      setConnected(false);
      void rejoin();
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setConnected(false);
        void rejoin();
        return;
      }
      resume();
    }

    void rejoin();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      clearRetry();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("pageshow", onPageShow);
      const current = channel;
      channel = null;
      lobbyChannelRef.current = null;
      setConnected(false);
      if (current) void client.removeChannel(current);
    };
  }, [
    clientId,
    copy.challengeDeclinedNotice,
    copy.challengeCancelledNotice,
    copy.challengeExpired,
    setActiveMatch,
    supabase,
    tenantId,
  ]);

  useEffect(() => {
    if (!connected) return;
    void lobbyChannelRef.current?.track(player);
  }, [connected, player]);

  useEffect(() => {
    if (!outgoingChallenge) return;
    const delay = Math.max(0, outgoingChallenge.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setOutgoingChallenge((current) => {
        if (!current || current.matchId !== outgoingChallenge.matchId) return current;
        outgoingRef.current = null;
        setOutgoingNotice(copy.challengeExpired);
        return null;
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [copy.challengeExpired, outgoingChallenge]);

  useEffect(() => {
    if (!incomingChallenge) return;
    const delay = Math.max(0, incomingChallenge.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setIncomingChallenge((current) => {
        if (!current || current.matchId !== incomingChallenge.matchId) return current;
        incomingRef.current = null;
        void lobbyChannelRef.current?.send({
          type: "broadcast",
          event: "challenge_declined",
          payload: {
            matchId: current.matchId,
            targetId: current.from.clientId,
            reason: "timeout",
          } satisfies ChallengeDeclinePayload,
        });
        return null;
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [incomingChallenge]);

  useEffect(() => {
    if (!outgoingNotice) return;
    const timer = window.setTimeout(() => setOutgoingNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [outgoingNotice]);

  const applyIdentity = useCallback((next: DuelIdentity) => {
    persistIdentity(next);
    setIdentity(next);

    const nextPlayer: DuelPlayer = {
      clientId,
      nickname: next.nickname,
      avatar: next.avatar,
      games: enabled,
      status: playerRef.current?.status ?? "idle",
      onlineAt: new Date().toISOString(),
    };
    void lobbyChannelRef.current?.track(nextPlayer);
  }, [clientId, enabled]);

  const rerollIdentity = useCallback(
    () => applyIdentity(generateIdentity()),
    [applyIdentity],
  );

  const chooseIdentity = useCallback(
    (next: DuelIdentity) => applyIdentity(next),
    [applyIdentity],
  );

  const sendChallenge = useCallback(
    (target: DuelPlayer) => {
      if (outgoingRef.current || incomingRef.current) return;
      if (match != null || drawRoomId != null) return;
      const gameId = resolveGameForMatch(selectedGame, enabled, target.games);
      if (!gameId) return;
      const matchId = makeMatchId(tenantId);
      const request: ChallengeRequestPayload = {
        matchId,
        gameId,
        targetId: target.clientId,
        from: playerRef.current ?? player,
      };
      const nextChallenge: OutgoingChallenge = {
        matchId,
        target,
        gameId,
        expiresAt: Date.now() + CHALLENGE_TIMEOUT_MS,
      };
      outgoingRef.current = nextChallenge;
      void lobbyChannelRef.current?.send({
        type: "broadcast",
        event: "challenge_request",
        payload: request,
      });
      setOutgoingChallenge(nextChallenge);
    },
    [drawRoomId, enabled, match, player, selectedGame, tenantId],
  );

  const cancelOutgoingChallenge = useCallback(() => {
    setOutgoingChallenge((current) => {
      if (current) {
        outgoingRef.current = null;
        void lobbyChannelRef.current?.send({
          type: "broadcast",
          event: "challenge_cancelled",
          payload: {
            challengerId: clientId,
            targetId: current.target.clientId,
          } satisfies ChallengeCancelPayload,
        });
      }
      return null;
    });
  }, [clientId]);

  const acceptIncomingChallenge = useCallback(() => {
    setIncomingChallenge((current) => {
      if (!current) return current;
      incomingRef.current = null;
      const accept: ChallengeAcceptPayload = {
        matchId: current.matchId,
        targetId: current.from.clientId,
        by: playerRef.current ?? player,
      };
      void lobbyChannelRef.current?.send({
        type: "broadcast",
        event: "challenge_accept",
        payload: accept,
      });
      setActiveMatch({ id: current.matchId, gameId: current.gameId, opponent: current.from });
      return null;
    });
  }, [player, setActiveMatch]);

  const declineIncomingChallenge = useCallback(() => {
    setIncomingChallenge((current) => {
      if (current) {
        incomingRef.current = null;
        void lobbyChannelRef.current?.send({
          type: "broadcast",
          event: "challenge_declined",
          payload: {
            matchId: current.matchId,
            targetId: current.from.clientId,
            reason: "declined",
          } satisfies ChallengeDeclinePayload,
        });
      }
      return null;
    });
  }, []);

  const exitMatch = useCallback(() => setActiveMatch(null), [setActiveMatch]);

  const joinDrawRoom = useCallback((roomId: string) => {
    if (match != null) return;
    incomingRef.current = null;
    outgoingRef.current = null;
    setIncomingChallenge(null);
    setOutgoingChallenge(null);
    setDrawRoomId(roomId);
  }, [match]);

  const leaveDrawRoom = useCallback(() => setDrawRoomId(null), []);

  const value = useMemo<DuelContextValue>(
    () => ({
      tenantId,
      ready: enabled.length > 0,
      enabledGames: enabled,
      identity,
      rerollIdentity,
      chooseIdentity,
      peers,
      connected,
      connectionError,
      player,
      selectedGame,
      setSelectedGame,
      sendChallenge,
      inMatch: match != null,
      inDrawRoom: drawRoomId != null,
      match,
      drawRoomId,
      exitMatch,
      joinDrawRoom,
      leaveDrawRoom,
    }),
    [
      connected,
      connectionError,
      chooseIdentity,
      drawRoomId,
      enabled,
      identity,
      joinDrawRoom,
      leaveDrawRoom,
      exitMatch,
      match,
      peers,
      player,
      rerollIdentity,
      selectedGame,
      sendChallenge,
      tenantId,
    ],
  );

  return (
    <DuelContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {incomingChallenge ? (
          <IncomingChallengeCard
            challenge={incomingChallenge}
            onAccept={acceptIncomingChallenge}
            onDecline={declineIncomingChallenge}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {outgoingChallenge ? (
          <OutgoingChallengeModal
            challenge={outgoingChallenge}
            onCancel={cancelOutgoingChallenge}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {outgoingNotice ? <NoticeToast message={outgoingNotice} /> : null}
      </AnimatePresence>
    </DuelContext.Provider>
  );
}

function IncomingChallengeCard({
  challenge,
  onAccept,
  onDecline,
}: {
  challenge: IncomingChallenge;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const copy = tenantConfig.copy.duel;
  const message = copy.challengeIncomingTemplate
    .replace("{nickname}", `${challenge.from.avatar} ${challenge.from.nickname}`)
    .replace("{game}", copy.gameLabels[challenge.gameId]);

  return (
    <motion.div
      className="fixed inset-x-4 top-6 z-[95] mx-auto max-w-md"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
    >
      <div className="overflow-hidden rounded-2xl border border-primary/25 bg-background shadow-lift">
        <div className="h-1 bg-surface">
          <motion.div
            className="h-full bg-red-500"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: CHALLENGE_TIMEOUT_MS / 1000, ease: "linear" }}
          />
        </div>
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <Swords className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-red-500">
              {copy.liveBadge}
            </p>
            <p className="mt-1 font-display text-lg leading-snug text-ink">
              {message}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={onDecline}
            className="btn-secondary min-h-12 text-sm"
          >
            {copy.challengeDecline}
          </button>
          <button
            type="button"
            onClick={onAccept}
            style={{ fontWeight: 650 }}
            className="min-h-12 rounded-2xl bg-emerald-500 text-sm tracking-wide text-white shadow-sm transition-transform active:scale-[0.98]"
          >
            {copy.challengeAccept}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function OutgoingChallengeModal({
  challenge,
  onCancel,
}: {
  challenge: OutgoingChallenge;
  onCancel: () => void;
}) {
  const copy = tenantConfig.copy.duel;
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  const secondsLeft =
    now === 0
      ? Math.ceil(CHALLENGE_TIMEOUT_MS / 1000)
      : Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000));
  const message = copy.challengeSendingTemplate
    .replace("{nickname}", `${challenge.target.avatar} ${challenge.target.nickname}`)
    .replace("{game}", copy.gameLabels[challenge.gameId])
    .replace("{seconds}", String(secondsLeft));

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/60 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="w-full max-w-xs rounded-2xl bg-background p-6 text-center shadow-lift"
      >
        <Swords className="mx-auto size-8 animate-pulse text-primary" />
        <p className="mt-4 text-sm font-medium leading-relaxed tracking-wide text-ink">
          {message}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary mt-5 w-full text-sm"
        >
          {copy.challengeCancel}
        </button>
      </motion.div>
    </motion.div>
  );
}

function NoticeToast({ message }: { message: string }) {
  return (
    <motion.div
      className="fixed inset-x-6 bottom-6 z-[95] mx-auto max-w-xs rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium tracking-wide text-background shadow-lift"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
    >
      {message}
    </motion.div>
  );
}
