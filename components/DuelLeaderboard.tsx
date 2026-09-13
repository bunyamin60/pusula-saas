"use client";

import { useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { tenantConfig } from "@/config/tenant.config";
import {
  fetchQuizLeaderboard,
  submitQuizScore,
  type QuizLeaderboardEntry,
} from "@/lib/duelLeaderboard";
import type { DuelPlayer } from "@/lib/duel";

type PlayerIdentity = Pick<
  DuelPlayer,
  "clientId" | "nickname" | "avatar"
>;

export function DuelLeaderboard({
  tenantId,
  player,
}: {
  tenantId: string;
  player: PlayerIdentity;
}) {
  const copy = tenantConfig.copy.duel;
  const [entries, setEntries] = useState<QuizLeaderboardEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetchQuizLeaderboard(tenantId, player.clientId).then((result) => {
      if (active) setEntries(result);
    });
    return () => {
      active = false;
    };
  }, [player.clientId, tenantId]);

  const topTen = entries?.filter((entry) => entry.rank <= 10) ?? [];
  const ownOutsideTopTen = entries?.find(
    (entry) => entry.clientId === player.clientId && entry.rank > 10,
  );

  return (
    <section className="mt-5 rounded-2xl border border-primary/20 bg-surface/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg leading-tight text-ink">
            {copy.leaderboardTitle}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            {copy.leaderboardAllTime}
          </p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary">
          <Trophy className="size-4" aria-hidden />
        </span>
      </div>

      {entries == null ? (
        <p className="mt-4 text-xs font-medium tracking-wide text-muted">
          {copy.leaderboardLoading}
        </p>
      ) : topTen.length === 0 ? (
        <p className="mt-4 text-xs font-medium tracking-wide text-muted">
          {copy.leaderboardEmpty}
        </p>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {topTen.map((entry) => (
            <LeaderboardRow
              key={entry.clientId}
              entry={entry}
              current={entry.clientId === player.clientId}
            />
          ))}
          {ownOutsideTopTen ? (
            <>
              <li className="py-0.5 text-center text-xs tracking-[0.2em] text-muted">
                ···
              </li>
              <LeaderboardRow entry={ownOutsideTopTen} current />
            </>
          ) : null}
        </ol>
      )}
    </section>
  );
}

function LeaderboardRow({
  entry,
  current,
}: {
  entry: QuizLeaderboardEntry;
  current: boolean;
}) {
  const copy = tenantConfig.copy.duel;
  return (
    <li
      className={`grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl px-2.5 py-2 ${
        current ? "bg-primary/10" : "bg-background/75"
      }`}
    >
      <span className="flex items-center justify-center font-display text-sm text-primary">
        {entry.rank === 1 ? (
          <Crown className="size-4" aria-label="1" />
        ) : (
          `#${entry.rank}`
        )}
      </span>
      <span className="min-w-0 truncate text-xs font-medium text-ink">
        {entry.avatar} {entry.nickname}
        {current ? (
          <span className="ml-1 text-[9px] uppercase tracking-wider text-primary">
            {copy.leaderboardYou}
          </span>
        ) : null}
      </span>
      <span className="text-xs font-semibold tabular-nums text-primary">
        {copy.leaderboardPointsTemplate.replace(
          "{score}",
          String(entry.score),
        )}
      </span>
    </li>
  );
}

export function QuizResultRank({
  tenantId,
  player,
  score,
}: {
  tenantId: string;
  player: PlayerIdentity;
  score: number;
}) {
  const copy = tenantConfig.copy.duel;
  const [result, setResult] = useState<{
    own: QuizLeaderboardEntry;
    leader: QuizLeaderboardEntry;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void submitQuizScore({
      tenantId,
      clientId: player.clientId,
      nickname: player.nickname,
      avatar: player.avatar,
      score,
    }).then(async (own) => {
      if (!own) return;
      const entries = await fetchQuizLeaderboard(tenantId, player.clientId);
      const leader = entries.find((entry) => entry.rank === 1) ?? own;
      if (active) setResult({ own, leader });
    });
    return () => {
      active = false;
    };
  }, [
    player.avatar,
    player.clientId,
    player.nickname,
    score,
    tenantId,
  ]);

  if (!result) return null;
  const gap = Math.max(0, result.leader.score - result.own.score);

  return (
    <div className="mx-auto mt-5 max-w-xs rounded-2xl border border-primary/20 bg-surface px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-primary">
        {result.own.rank === 1
          ? copy.leaderboardRecord
          : copy.leaderboardRankTemplate.replace(
              "{rank}",
              String(result.own.rank),
            )}
      </p>
      {gap > 0 ? (
        <p className="mt-1 text-[11px] font-medium tracking-wide text-muted">
          {copy.leaderboardGapTemplate.replace("{score}", String(gap))}
        </p>
      ) : null}
    </div>
  );
}
