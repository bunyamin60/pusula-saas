"use client";

import { useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { GuestAvatarImage } from "@/components/GuestAvatarImage";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { readCustomerProfile, type CustomerProfile } from "@/lib/customerProfile";
import {
  entryAvatarSrc,
  fetchQuizLeaderboard,
  submitQuizScore,
  type QuizLeaderboardEntry,
} from "@/lib/duelLeaderboard";
import type { DuelPlayer } from "@/lib/duel";
import { getActiveTableLabel } from "@/lib/tableSession";

type PlayerIdentity = Pick<
  DuelPlayer,
  "clientId" | "nickname" | "avatar"
>;

function guestScoreName(tenantId: string) {
  return tenantConfig.copy.duel.guestPlayer.replace(
    "{table}",
    getActiveTableLabel(tenantId),
  );
}

function currentRowLabel(profile: CustomerProfile | null, tenantId: string) {
  if (profile?.name) return `${profile.name} ⭐`;
  return guestScoreName(tenantId);
}

export function DuelLeaderboard({
  tenantId,
  player,
  score,
  category,
}: {
  tenantId: string;
  player: PlayerIdentity;
  score?: number;
  category?: string | null;
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
    void fetchQuizLeaderboard(
      tenantId,
      player.clientId,
      "quiz",
      category,
    ).then((result) => {
      if (active) setEntries(result);
    });
    return () => {
      active = false;
    };
  }, [category, player.clientId, tenantId]);

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
      tableId: getActiveTableLabel(tenantId),
      avatarUrl: next.avatarUrl,
      category,
    });
    const refreshed = await fetchQuizLeaderboard(
      tenantId,
      player.clientId,
      "quiz",
      category,
    );
    setEntries(
      refreshed.length > 0
        ? refreshed
        : updated
          ? [updated]
          : entries,
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-sans text-lg font-extrabold leading-tight tracking-tight text-[var(--text-headline)]">
            {copy.leaderboardTitle}
          </p>
          <p className="mt-1 font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-body)]">
            {copy.leaderboardAllTime}
          </p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--btn-primary)] text-[var(--btn-text)]">
          <Trophy className="size-4" aria-hidden />
        </span>
      </div>

      {entries == null ? (
        <p className="mt-4 font-sans text-xs font-medium tracking-wide text-[var(--text-body)]">
          {copy.leaderboardLoading}
        </p>
      ) : topTen.length === 0 && !ownEntry ? (
        <p className="mt-4 font-sans text-xs font-medium tracking-wide text-[var(--text-body)]">
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
                  ? currentRowLabel(profile, tenantId)
                  : entry.nickname
              }
            />
          ))}
          {ownOutsideTopTen ? (
            <>
              <li className="py-0.5 text-center font-sans text-xs tracking-[0.2em] text-[var(--text-body)]">
                ···
              </li>
              <LeaderboardRow
                entry={ownOutsideTopTen}
                current
                label={currentRowLabel(profile, tenantId)}
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
  const avatarSrc = entryAvatarSrc(entry);
  return (
    <li
      className={`grid grid-cols-[2rem_auto_1fr_auto] items-center gap-2 rounded-xl px-2.5 py-2 ${
        current
          ? "bg-[var(--btn-primary)]/25"
          : "bg-[var(--bg-canvas)]"
      }`}
    >
      <span className="flex items-center justify-center font-sans text-sm font-extrabold text-[var(--text-headline)]">
        {entry.rank === 1 ? (
          <Crown className="size-4" aria-label="1" />
        ) : (
          `#${entry.rank}`
        )}
      </span>
      {avatarSrc ? (
        <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-[var(--border)]">
          <GuestAvatarImage src={avatarSrc} sizes="32px" />
        </span>
      ) : (
        <span className="size-8 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 truncate font-sans text-xs font-medium text-[var(--text-headline)]">
        {label}
        {current ? (
          <span className="ml-1 text-[9px] uppercase tracking-wider text-[var(--text-body)]">
            {copy.leaderboardYou}
          </span>
        ) : null}
      </span>
      <span className="font-sans text-xs font-semibold tabular-nums text-[var(--text-headline)]">
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
      nickname: profile?.name || guestScoreName(tenantId),
      avatar: player.avatar,
      score,
      tableId: getActiveTableLabel(tenantId),
      avatarUrl: profile?.avatarUrl,
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
    <div className="mx-auto mt-5 max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] px-4 py-3">
      <p className="font-sans text-xs font-semibold tracking-wide text-[var(--text-headline)]">
        {result.own.rank === 1
          ? copy.leaderboardRecord
          : result.own.rank <= 5
            ? copy.rankTop.replace("{rank}", String(result.own.rank))
            : copy.rankOther.replace("{rank}", String(result.own.rank))}
      </p>
      {gap > 0 ? (
        <p className="mt-1 font-sans text-[11px] font-medium tracking-wide text-[var(--text-body)]">
          {copy.leaderboardGapTemplate.replace("{score}", String(gap))}
        </p>
      ) : null}
    </div>
  );
}
