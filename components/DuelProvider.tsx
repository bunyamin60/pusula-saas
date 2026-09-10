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
import { GameContainer } from "@/components/GameContainer";
import { tenantConfig, type DuelGameId } from "@/config/tenant.config";
import {
  CHALLENGE_TIMEOUT_MS,
  enabledGameIds,
  generateIdentity,
  makeDuelClientId,
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
import { getSupabase } from "@/lib/supabase";
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
  ready: boolean;
  enabledGames: DuelGameId[];
  identity: DuelIdentity;
  rerollIdentity: () => void;
  peers: DuelPlayer[];
  connected: boolean;
  player: DuelPlayer;
  selectedGame: SelectedGame;
  setSelectedGame: (game: SelectedGame) => void;
  sendChallenge: (target: DuelPlayer) => void;
  inMatch: boolean;
};

const DuelContext = createContext<DuelContextValue | null>(null);

export function useDuel(): DuelContextValue {
  const ctx = useContext(DuelContext);
  if (!ctx) {
    throw new Error("useDuel must be used within a DuelProvider");
  }
  return ctx;
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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerRef = useRef<DuelPlayer | null>(null);
  const outgoingRef = useRef<OutgoingChallenge | null>(null);
  const incomingRef = useRef<IncomingChallenge | null>(null);

  const [clientId] = useState(makeDuelClientId);
  const [identity, setIdentity] = useState<DuelIdentity>(generateIdentity);
  const [peers, setPeers] = useState<DuelPlayer[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedGame, setSelectedGame] = useState<SelectedGame>(
    () => enabled[0] ?? "random",
  );
  const [outgoingChallenge, setOutgoingChallenge] =
    useState<OutgoingChallenge | null>(null);
  const [incomingChallenge, setIncomingChallenge] =
    useState<IncomingChallenge | null>(null);
  const [outgoingNotice, setOutgoingNotice] = useState<string | null>(null);
  const [match, setMatch] = useState<DuelMatch | null>(null);

  useEffect(() => {
    outgoingRef.current = outgoingChallenge;
  }, [outgoingChallenge]);

  useEffect(() => {
    incomingRef.current = incomingChallenge;
  }, [incomingChallenge]);

  const busy = match != null || outgoingChallenge != null || incomingChallenge != null;

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
    if (!supabase || enabled.length === 0) return;
    const channel = supabase.channel(`tenant_${tenantId}_lobby`, {
      config: {
        presence: { key: clientId },
        broadcast: { self: false },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<DuelPlayer>();
        const next = Object.values(state)
          .flat()
          .map(
            (entry): DuelPlayer => ({
              clientId: entry.clientId,
              nickname: entry.nickname,
              avatar: entry.avatar,
              games: entry.games,
              status: entry.status,
              onlineAt: entry.onlineAt,
            }),
          )
          .filter(
            (entry) => entry.clientId !== clientId && entry.status === "idle",
          );
        setPeers(next);
      })
      .on("broadcast", { event: "challenge_request" }, ({ payload }) => {
        const request = payload as ChallengeRequestPayload;
        const current = playerRef.current;
        if (!current || request.targetId !== current.clientId) return;
        if (current.status !== "idle") return;
        setIncomingChallenge({
          matchId: request.matchId,
          from: request.from,
          gameId: request.gameId,
          expiresAt: Date.now() + CHALLENGE_TIMEOUT_MS,
        });
      })
      .on("broadcast", { event: "challenge_cancel" }, ({ payload }) => {
        const cancel = payload as ChallengeCancelPayload;
        if (cancel.targetId !== clientId) return;
        const current = incomingRef.current;
        if (!current || current.matchId !== cancel.matchId) return;
        setIncomingChallenge(null);
      })
      .on("broadcast", { event: "challenge_accept" }, ({ payload }) => {
        const accept = payload as ChallengeAcceptPayload;
        if (accept.targetId !== clientId) return;
        const current = outgoingRef.current;
        if (!current || current.matchId !== accept.matchId) return;
        setOutgoingChallenge(null);
        setMatch({ id: accept.matchId, gameId: current.gameId, opponent: accept.by });
      })
      .on("broadcast", { event: "challenge_decline" }, ({ payload }) => {
        const decline = payload as ChallengeDeclinePayload;
        if (decline.targetId !== clientId) return;
        const current = outgoingRef.current;
        if (!current || current.matchId !== decline.matchId) return;
        setOutgoingChallenge(null);
        setOutgoingNotice(copy.challengeExpired);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          if (playerRef.current) await channel.track(playerRef.current);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
        }
      });

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [clientId, copy.challengeExpired, enabled.length, supabase, tenantId]);

  useEffect(() => {
    if (!connected) return;
    void channelRef.current?.track(player);
  }, [connected, player]);

  useEffect(() => {
    if (!outgoingChallenge) return;
    const delay = Math.max(0, outgoingChallenge.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setOutgoingChallenge((current) => {
        if (!current || current.matchId !== outgoingChallenge.matchId) return current;
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
        void channelRef.current?.send({
          type: "broadcast",
          event: "challenge_decline",
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

  const rerollIdentity = useCallback(() => setIdentity(generateIdentity()), []);

  const sendChallenge = useCallback(
    (target: DuelPlayer) => {
      if (outgoingRef.current || incomingRef.current) return;
      const gameId = resolveGameForMatch(selectedGame, enabled, target.games);
      if (!gameId) return;
      const matchId = makeMatchId(tenantId);
      const request: ChallengeRequestPayload = {
        matchId,
        gameId,
        targetId: target.clientId,
        from: playerRef.current ?? player,
      };
      void channelRef.current?.send({
        type: "broadcast",
        event: "challenge_request",
        payload: request,
      });
      setOutgoingChallenge({
        matchId,
        target,
        gameId,
        expiresAt: Date.now() + CHALLENGE_TIMEOUT_MS,
      });
    },
    [enabled, player, selectedGame, tenantId],
  );

  const cancelOutgoingChallenge = useCallback(() => {
    setOutgoingChallenge((current) => {
      if (current) {
        void channelRef.current?.send({
          type: "broadcast",
          event: "challenge_cancel",
          payload: {
            matchId: current.matchId,
            targetId: current.target.clientId,
          } satisfies ChallengeCancelPayload,
        });
      }
      return null;
    });
  }, []);

  const acceptIncomingChallenge = useCallback(() => {
    setIncomingChallenge((current) => {
      if (!current) return current;
      const accept: ChallengeAcceptPayload = {
        matchId: current.matchId,
        targetId: current.from.clientId,
        by: playerRef.current ?? player,
      };
      void channelRef.current?.send({
        type: "broadcast",
        event: "challenge_accept",
        payload: accept,
      });
      setMatch({ id: current.matchId, gameId: current.gameId, opponent: current.from });
      return null;
    });
  }, [player]);

  const declineIncomingChallenge = useCallback(() => {
    setIncomingChallenge((current) => {
      if (current) {
        void channelRef.current?.send({
          type: "broadcast",
          event: "challenge_decline",
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

  const exitMatch = useCallback(() => setMatch(null), []);

  const value = useMemo<DuelContextValue>(
    () => ({
      ready: enabled.length > 0,
      enabledGames: enabled,
      identity,
      rerollIdentity,
      peers,
      connected,
      player,
      selectedGame,
      setSelectedGame,
      sendChallenge,
      inMatch: match != null,
    }),
    [connected, enabled, identity, match, peers, player, rerollIdentity, selectedGame, sendChallenge],
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
      {match ? (
        <GameContainer match={match} player={player} onExit={exitMatch} />
      ) : null}
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
