"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Brain,
  Check,
  Clapperboard,
  Dices,
  Hash,
  Radio,
  Shuffle,
  Smile,
  Swords,
  UserRound,
  X,
  type LucideProps,
} from "lucide-react";
import { useDuel } from "@/components/DuelProvider";
import { DuelLeaderboard } from "@/components/DuelLeaderboard";
import { RewardProgressBar } from "@/components/RewardProgressBar";
import { tenantConfig, type DuelGameId } from "@/config/tenant.config";
import { commonGames } from "@/lib/duel";

export function DuelExperience() {
  const copy = tenantConfig.copy.duel;
  const { ready, inMatch, inDrawRoom } = useDuel();
  const [open, setOpen] = useState(false);
  const [wasBusy, setWasBusy] = useState(inMatch || inDrawRoom);
  const busy = inMatch || inDrawRoom;

  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (busy) setOpen(false);
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

export function DuelLobbyDrawer({
  onClose,
  focusGame,
  variant = "drawer",
}: {
  onClose: () => void;
  focusGame?: DuelGameId;
  variant?: "drawer" | "page";
}) {
  const copy = tenantConfig.copy.duel;
  const {
    tenantId,
    identity,
    rerollIdentity,
    chooseIdentity,
    peers,
    connected,
    connectionError,
    enabledGames,
    selectedGame,
    setSelectedGame,
    sendChallenge,
    player,
  } = useDuel();
  const [nicknamePickerOpen, setNicknamePickerOpen] = useState(false);

  useEffect(() => {
    if (focusGame) setSelectedGame(focusGame);
  }, [focusGame, setSelectedGame]);

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

  const page = variant === "page";

  return (
    <motion.div
      className={
        page
          ? "relative flex flex-1 flex-col"
          : "fixed inset-0 z-[60] flex items-end justify-center"
      }
      initial={page ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={page ? undefined : { opacity: 0 }}
    >
      {page ? null : (
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="absolute inset-0 bg-ink/55"
        />
      )}
      <motion.section
        role={page ? undefined : "dialog"}
        aria-modal={page ? undefined : true}
        initial={page ? false : { y: "100%" }}
        animate={{ y: 0 }}
        exit={page ? undefined : { y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className={
          page
            ? "relative z-10 flex flex-1 flex-col bg-background"
            : "relative z-10 max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-lift"
        }
      >
        {page ? null : <div className="mx-auto h-1.5 w-12 rounded-full bg-ink/15" />}
        {page ? null : (
          <div className="mt-3">
            <RewardProgressBar />
          </div>
        )}
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
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-surface text-ink"
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
          <div className="mt-2 flex items-center gap-3">
            <p className="min-w-0 flex-1 font-display text-lg text-ink">
              {identity.avatar} {identity.nickname}
            </p>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setNicknamePickerOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-background px-2.5 py-2 text-xs font-medium tracking-wide text-primary"
              >
                <UserRound className="size-3.5" />
                {copy.chooseNickname}
              </button>
              <button
                type="button"
                onClick={rerollIdentity}
                className="flex items-center gap-1.5 rounded-full bg-background px-2.5 py-2 text-xs font-medium tracking-wide text-primary"
              >
                <Dices className="size-3.5" />
                {copy.rerollNickname}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
            {copy.selectGameTitle}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {focusGame ? null : (
              <GameCard
                active={selectedGame === "random"}
                onClick={() => setSelectedGame("random")}
                icon={Shuffle}
                label={copy.randomGameLabel}
                description={copy.randomGameDescription}
              />
            )}
            {enabledGames
              .filter((id) => !focusGame || id === focusGame)
              .map((id) => (
              <GameCard
                key={id}
                active={selectedGame === id}
                onClick={() => setSelectedGame(id)}
                icon={gameIcon(id)}
                label={copy.gameLabels[id]}
                description={copy.gameDescriptions[id]}
              />
            ))}
          </div>
        </div>

        {selectedGame === "quiz" ? (
          <DuelLeaderboard tenantId={tenantId} player={player} />
        ) : null}

        <div className="mt-6 rounded-2xl border border-primary/20 px-4 py-4">
          <p
            className={`text-sm font-medium tracking-wide ${
              connectionError && !connected ? "text-red-600" : "text-ink"
            }`}
          >
            {connected
              ? copy.onlineTemplate.replace("{count}", String(peers.length + 1))
              : connectionError
                ? copy.unavailable
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
      <AnimatePresence>
        {nicknamePickerOpen ? (
          <NicknamePicker
            currentNickname={identity.nickname}
            onClose={() => setNicknamePickerOpen(false)}
            onSelect={(next) => {
              chooseIdentity(next);
              setNicknamePickerOpen(false);
            }}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function NicknamePicker({
  currentNickname,
  onClose,
  onSelect,
}: {
  currentNickname: string;
  onClose: () => void;
  onSelect: (identity: { nickname: string; avatar: string }) => void;
}) {
  const copy = tenantConfig.copy.duel;
  return (
    <motion.div
      className="fixed inset-0 z-20 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={copy.close}
        className="absolute inset-0 bg-ink/60"
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="relative z-10 max-h-[78dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-lift"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl text-ink">
              {copy.nicknamePickerTitle}
            </h3>
            <p className="mt-1 text-xs font-medium leading-relaxed tracking-wide text-muted">
              {copy.nicknamePickerLead}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {tenantConfig.duel.nicknames.aliases.map((alias) => {
            const active = alias.nickname === currentNickname;
            return (
              <button
                key={alias.nickname}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(alias)}
                className={`relative min-h-16 rounded-2xl border px-3 py-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary text-on-primary"
                    : "border-primary/10 bg-surface text-ink"
                }`}
              >
                <span className="block text-xl" aria-hidden>
                  {alias.avatar}
                </span>
                <span className="mt-1 block font-display text-sm leading-tight">
                  {alias.nickname}
                </span>
                {active ? (
                  <Check className="absolute right-2.5 top-2.5 size-3.5" />
                ) : null}
              </button>
            );
          })}
        </div>
      </motion.section>
    </motion.div>
  );
}

function GameCard({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<LucideProps>;
  label: string;
  description: string;
}) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative min-h-[5.25rem] rounded-2xl border px-3 py-3 text-left transition-all ${
        active
          ? "border-primary bg-primary text-on-primary shadow-sm"
          : "border-primary/10 bg-surface text-ink"
      }`}
    >
      <span
        className={`flex size-8 items-center justify-center rounded-xl ${
          active ? "bg-white/15" : "bg-background text-primary"
        }`}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      {active ? (
        <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-white/20">
          <Check className="size-3" aria-hidden />
        </span>
      ) : null}
      <span className="mt-2 block font-display text-sm leading-tight">
        {label}
      </span>
      <span
        className={`mt-1 line-clamp-1 block text-[10px] leading-snug ${
          active ? "text-on-primary/75" : "text-muted"
        }`}
      >
        {description}
      </span>
    </button>
  );
}

function gameIcon(id: DuelGameId): ComponentType<LucideProps> {
  if (id === "trivia") return Clapperboard;
  if (id === "emoji") return Smile;
  if (id === "swipe") return ArrowLeftRight;
  if (id === "number") return Hash;
  return Brain;
}
