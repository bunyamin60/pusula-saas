"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Radio, Users, X } from "lucide-react";
import { DuelLobbyDrawer } from "@/components/DuelLobby";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import {
  arcadeDuelMode,
  arcadeGameCopy,
  arcadeLobbyKind,
  type ArcadeGame,
} from "@/lib/gameCatalog";

type GameLobbyModalProps = {
  game: ArcadeGame;
  onClose: () => void;
  onEnter: () => void;
};

export function GameLobbyModal({ game, onClose, onEnter }: GameLobbyModalProps) {
  const kind = arcadeLobbyKind(game.id);
  const duelMode = arcadeDuelMode(game.id);

  if (kind === "duel" && duelMode) {
    return <DuelLobbyDrawer focusGame={duelMode} onClose={onClose} />;
  }

  if (kind !== "table") return null;

  return <TableReadySheet game={game} onClose={onClose} onEnter={onEnter} />;
}

function TableReadySheet({
  game,
  onClose,
  onEnter,
}: GameLobbyModalProps) {
  const copy = tenantConfig.copy.landing.gameLobby;
  const { title, badge } = arcadeGameCopy(game.id);
  const { peers, connected, connectionError, player } = useDuel();
  const count = peers.length + 1;

  return (
    <AnimatePresence>
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
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--card-border)] bg-[var(--bg-canvas)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-lift"
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-[var(--card-surface)]" />
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-body)]">
                <Radio className="size-3 animate-pulse" />
                {copy.tableKicker}
              </p>
              <h2 className="mt-1 font-sans text-2xl font-extrabold tracking-tight text-[var(--text-headline)]">{title}</h2>
              <p className="mt-1 font-sans text-xs font-medium text-[var(--text-body)]">{badge}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.close}
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-[var(--text-headline)]/20 bg-[var(--bg-canvas)] text-[var(--text-headline)]"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] px-4 py-4">
            <p className="flex items-center gap-2 font-sans text-sm font-semibold text-[var(--text-headline)]">
              <Users className="size-4 text-[var(--text-headline)]" />
              {copy.playersTemplate.replace("{count}", String(count))}
            </p>
            <p className="mt-2 font-sans text-xs font-medium text-[var(--text-body)]">
              {connected
                ? `${player.avatar} ${player.nickname}`
                : connectionError
                  ? tenantConfig.copy.duel.unavailable
                  : copy.searching}
            </p>
            {peers.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {peers.map((peer) => (
                  <li
                    key={peer.clientId}
                    className="font-sans text-xs font-medium text-[var(--text-body)]"
                  >
                    {peer.avatar} {peer.nickname}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mt-5 grid gap-2.5">
            <button type="button" onClick={onEnter} className="btn-primary w-full">
              {copy.start}
            </button>
            <button type="button" onClick={onEnter} className="btn-secondary w-full">
              {copy.join}
            </button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
