"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Dices, Radio, Shuffle, Swords, X } from "lucide-react";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { commonGames } from "@/lib/duel";

export function DuelExperience() {
  const copy = tenantConfig.copy.duel;
  const { ready, inMatch } = useDuel();
  const [open, setOpen] = useState(false);
  const [wasInMatch, setWasInMatch] = useState(inMatch);

  if (inMatch !== wasInMatch) {
    setWasInMatch(inMatch);
    if (inMatch) setOpen(false);
  }

  if (!ready) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-surface px-4 font-display text-lg text-ink shadow-sm"
      >
        <Swords className="size-5 text-primary" />
        {copy.entry}
        <span className="absolute right-3 top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white">
          {copy.liveBadge}
        </span>
      </button>
      <AnimatePresence>
        {open ? <DuelLobbyDrawer onClose={() => setOpen(false)} /> : null}
      </AnimatePresence>
    </>
  );
}

export function DuelLobbyDrawer({ onClose }: { onClose: () => void }) {
  const copy = tenantConfig.copy.duel;
  const {
    identity,
    rerollIdentity,
    peers,
    connected,
    enabledGames,
    selectedGame,
    setSelectedGame,
    sendChallenge,
  } = useDuel();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const eligiblePeers = useMemo(
    () =>
      peers.filter((peer) =>
        selectedGame === "random"
          ? commonGames(enabledGames, peer.games).length > 0
          : peer.games.includes(selectedGame),
      ),
    [enabledGames, peers, selectedGame],
  );

  function findMatch() {
    if (eligiblePeers.length === 0) return;
    const target = eligiblePeers[Math.floor(Math.random() * eligiblePeers.length)];
    sendChallenge(target);
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={copy.close}
        className="absolute inset-0 bg-ink/55"
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="relative z-10 max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-lift"
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-ink/15" />
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-500">
              <Radio className="size-3 animate-pulse" />
              {copy.liveBadge}
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">{copy.lobbyTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="flex size-10 items-center justify-center rounded-full bg-surface text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm font-medium leading-relaxed tracking-wide text-muted">
          {copy.lobbyLead}
        </p>

        <div className="mt-6 rounded-2xl bg-surface p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
            {copy.nicknameLabel}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="font-display text-lg text-ink">
              {identity.avatar} {identity.nickname}
            </p>
            <button
              type="button"
              onClick={rerollIdentity}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-background px-3 py-2 text-xs font-medium tracking-wide text-primary"
            >
              <Dices className="size-3.5" />
              {copy.rerollNickname}
            </button>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
            {copy.selectGameTitle}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <GameChip
              active={selectedGame === "random"}
              onClick={() => setSelectedGame("random")}
              icon={<Shuffle className="size-3.5" />}
              label={copy.randomGameLabel}
            />
            {enabledGames.map((id) => (
              <GameChip
                key={id}
                active={selectedGame === id}
                onClick={() => setSelectedGame(id)}
                label={copy.gameLabels[id]}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-primary/20 px-4 py-4">
          <p className="text-sm font-medium tracking-wide text-ink">
            {connected
              ? copy.onlineTemplate.replace("{count}", String(peers.length + 1))
              : copy.connecting}
          </p>
          {connected && peers.length === 0 ? (
            <p className="mt-2 text-xs font-medium tracking-wide text-muted">
              {copy.noPlayers}
            </p>
          ) : null}
          {peers.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {peers.map((peer) => (
                <li
                  key={peer.clientId}
                  className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted"
                >
                  <span>{peer.avatar}</span>
                  <span>{peer.nickname}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {!connected ? (
          <p className="mt-4 text-center text-sm font-medium tracking-wide text-red-600">
            {copy.unavailable}
          </p>
        ) : null}
        <button
          type="button"
          onClick={findMatch}
          disabled={!connected || eligiblePeers.length === 0}
          className="btn-primary mt-5 w-full gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="size-4" />
          {copy.matchRandom}
        </button>
      </motion.section>
    </motion.div>
  );
}

function GameChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-sm transition-colors ${
        active
          ? "border border-primary bg-primary text-on-primary shadow-sm"
          : "border border-transparent bg-surface text-ink/60"
      }`}
    >
      {icon}
      {label}
      {active ? <Check className="size-3.5" /> : null}
    </button>
  );
}
