"use client";

import { useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { readCustomerProfile, type CustomerProfile } from "@/lib/customerProfile";
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

function guestScoreName() {
  return tenantConfig.copy.duel.guestPlayer.replace(
    "{table}",
    tenantConfig.brand.tableName,
  );
}

function currentRowLabel(profile: CustomerProfile | null) {
  if (profile?.name) return `${profile.name} ⭐`;
  return guestScoreName();
}

export function DuelLeaderboard({
  tenantId,
  player,
  score,
}: {
  tenantId: string;
  player: PlayerIdentity;
  score?: number;
}) {
  const copy = tenantConfig.copy.duel;
  const { chooseIdentity } = useDuel();
  const [entries, setEntries] = useState<QuizLeaderboardEntry[] | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    setProfile(readCustomerProfile());
  }, []);

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
  const ownEntry = entries?.find((entry) => entry.clientId === player.clientId);
  const ownOutsideTopTen =
    ownEntry && ownEntry.rank > 10 ? ownEntry : undefined;
  const showSaveCta = !profile && (score != null || Boolean(ownEntry));

  async function bindScore(next: CustomerProfile) {
    setProfile(next);
    chooseIdentity({ nickname: next.name, avatar: player.avatar });
    const boundScore = score ?? ownEntry?.score ?? 0;
    const updated = await submitQuizScore({
      tenantId,
      clientId: player.clientId,
      nickname: next.name,
      avatar: player.avatar,
      score: boundScore,
    });
    const refreshed = await fetchQuizLeaderboard(tenantId, player.clientId);
    setEntries(
      refreshed.length > 0
        ? refreshed
        : updated
          ? [updated]
          : entries,
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#272343]/15 bg-[#e3f6f5] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-sans text-lg font-extrabold leading-tight tracking-tight text-[#272343]">
            {copy.leaderboardTitle}
          </p>
          <p className="mt-1 font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-[#2d334a]">
            {copy.leaderboardAllTime}
          </p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-[#ffd803] text-[#272343]">
          <Trophy className="size-4" aria-hidden />
        </span>
      </div>

      {entries == null ? (
        <p className="mt-4 text-xs font-medium tracking-wide text-muted">
          {copy.leaderboardLoading}
        </p>
      ) : topTen.length === 0 && !ownEntry ? (
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
              label={
                entry.clientId === player.clientId
                  ? currentRowLabel(profile)
                  : `${entry.avatar} ${entry.nickname}`
              }
            />
          ))}
          {ownOutsideTopTen ? (
            <>
              <li className="py-0.5 text-center text-xs tracking-[0.2em] text-muted">
                ···
              </li>
              <LeaderboardRow
                entry={ownOutsideTopTen}
                current
                label={currentRowLabel(profile)}
              />
            </>
          ) : null}
        </ol>
      )}

      {showSaveCta ? (
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="mt-3 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3 text-sm font-extrabold text-[var(--btn-text)] shadow-md transition-all hover:brightness-95 active:scale-95"
        >
          {copy.saveScoreCta}
        </button>
      ) : null}

      <CustomerAuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSaved={(next) => {
          void bindScore(next);
        }}
      />
    </section>
  );
}

function LeaderboardRow({
  entry,
  current,
  label,
}: {
  entry: QuizLeaderboardEntry;
  current: boolean;
  label: string;
}) {
  const copy = tenantConfig.copy.duel;
  return (
    <li
      className={`grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl px-2.5 py-2 ${
        current ? "bg-[#ffd803]/35" : "bg-[#fffffe]"
      }`}
    >
      <span className="flex items-center justify-center font-sans text-sm font-extrabold text-[#272343]">
        {entry.rank === 1 ? (
          <Crown className="size-4" aria-label="1" />
        ) : (
          `#${entry.rank}`
        )}
      </span>
      <span className="min-w-0 truncate font-sans text-xs font-medium text-[#272343]">
        {label}
        {current ? (
          <span className="ml-1 text-[9px] uppercase tracking-wider text-[#2d334a]">
            {copy.leaderboardYou}
          </span>
        ) : null}
      </span>
      <span className="font-sans text-xs font-semibold tabular-nums text-[#272343]">
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
    const profile = readCustomerProfile();
    void submitQuizScore({
      tenantId,
      clientId: player.clientId,
      nickname: profile?.name || guestScoreName(),
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
    <div className="mx-auto mt-5 max-w-xs rounded-2xl border border-[#272343]/15 bg-[#e3f6f5] px-4 py-3">
      <p className="font-sans text-xs font-semibold tracking-wide text-[#272343]">
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
