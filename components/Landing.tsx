"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Medal, Trophy } from "lucide-react";
import { ArcadeGameCard } from "@/components/ArcadeGameCard";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { DailyQuestionFeed } from "@/components/DailyQuestionFeed";
import { DeviceTestReset } from "@/components/DeviceTestReset";
import { LoyaltyStampCard } from "@/components/LoyaltyStampCard";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { arcadeGameCopy, featuredArcadeGames } from "@/lib/gameCatalog";
import {
  readCustomerProfile,
  type CustomerProfile,
} from "@/lib/customerProfile";
import {
  fetchQuizLeaderboard,
  type ArcadeScoreGame,
  type QuizLeaderboardEntry,
} from "@/lib/duelLeaderboard";
import { resolveLogoUrl } from "@/lib/tenant";
import { useCampaign } from "@/lib/useCampaign";

type LobbyTab = "games" | "events" | "surveys";

export function Landing() {
  const copy = tenantConfig.copy.landing;
  const campaign = useCampaign();
  const router = useRouter();
  const { tenantId, player, chooseIdentity } = useDuel();
  const [tab, setTab] = useState<LobbyTab>("games");
  const [authOpen, setAuthOpen] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    setProfile(readCustomerProfile());
  }, []);

  const brand = (campaign.brandName || tenantConfig.brand.name).trim();
  const logoUrl =
    resolveLogoUrl(campaign.logoUrl, tenantId) || tenantConfig.brand.logoUrl;
  const google =
    campaign.googleReviewUrl || tenantConfig.reward.googleReviewUrl;
  const instagram =
    campaign.instagramUrl || tenantConfig.reward.instagramUrl;
  const visible = featuredArcadeGames(campaign.enabledGames);
  const tabs: Array<[LobbyTab, string]> = [
    ["games", copy.tabs.games],
    ["events", copy.tabs.events],
    ["surveys", copy.tabs.surveys],
  ];

  return (
    <section className="flex flex-col pb-2">
      {!profile ? (
        <div className="flex items-center gap-2 rounded-2xl border border-ink/15 bg-surface px-3 py-2.5">
          <p className="min-w-0 flex-1 font-sans text-[12px] font-medium leading-snug text-muted">
            {copy.loginBanner}
          </p>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="shrink-0 rounded-2xl bg-primary px-3 py-1.5 font-sans text-[11px] font-bold text-on-primary shadow-sm transition hover:brightness-95 active:scale-95"
          >
            {copy.loginCta}
          </button>
        </div>
      ) : null}

      <header className={`text-center ${profile ? "mt-1" : "mt-3"}`}>
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={brand}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="font-sans text-[10px] font-black uppercase tracking-wide text-[var(--text-headline)]">
              {brand.slice(0, 2)}
            </span>
          )}
        </div>
        <h1 className="font-sans text-xl font-black tracking-tight text-[var(--text-headline)]">
          {brand}
        </h1>
        <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-[var(--text-body)]/70">
          {copy.hallName}
        </p>
        {profile ? (
          <span className="mt-1.5 inline-flex rounded-full border border-[var(--text-headline)]/15 bg-[var(--card-surface)] px-2.5 py-1 font-sans text-[11px] font-semibold text-[var(--text-headline)]">
            {copy.welcomeBadge.replace("{name}", profile.name)}
          </span>
        ) : null}
      </header>
      {google || instagram ? (
        <div className="mt-2 flex items-center justify-center gap-2">
          {google ? (
            <a
              href={google}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-[var(--text-headline)]/20 text-[var(--text-headline)] hover:bg-[var(--card-surface)] text-xs font-semibold px-3.5 py-1.5 rounded-full transition"
            >
              <GoogleMark />
              {copy.googleReviewChip}
            </a>
          ) : null}
          {instagram ? (
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-[var(--text-headline)]/20 text-[var(--text-headline)] hover:bg-[var(--card-surface)] text-xs font-semibold px-3.5 py-1.5 rounded-full transition"
            >
              <InstagramMark />
              {copy.instagramChip}
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 rounded-full border border-ink/15 bg-surface p-1">
        <div className="grid grid-cols-3 gap-1">
          {tabs.map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-full px-2 py-2 font-sans text-[12px] tracking-wide transition-colors ${
                  active
                    ? "bg-[var(--tab-active-bg)] font-extrabold text-[var(--tab-active-text)] shadow-sm"
                    : "font-medium text-[var(--text-body)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "games" ? (
        <div className="-mx-5 mt-1 grid grid-cols-2 gap-3 px-4 pb-3 pt-2">
          {visible.map((game) => {
            const { title, badge, caption } = arcadeGameCopy(game.id);
            return (
              <ArcadeGameCard
                key={game.id}
                game={game}
                title={title}
                badge={badge}
                caption={caption}
                onClick={() => router.push(`/${tenantId}${game.path}`)}
              />
            );
          })}
        </div>
      ) : tab === "events" ? (
        <div className="space-y-4">
          <LoyaltyStampCard
            tenantId={tenantId}
            clientId={player.clientId}
            tableId={tenantConfig.brand.tableName}
          />
          <DailyQuestionFeed tenantId={tenantId} clientId={player.clientId} />
          <EventsRaceCard
            tenantId={tenantId}
            gameType="quiz"
            href={`/${tenantId}/trivia`}
            copy={copy.race}
          />
          <EventsRaceCard
            tenantId={tenantId}
            gameType="blockblast"
            href={`/${tenantId}/blockblast`}
            copy={copy.blastRace}
            medals
          />
        </div>
      ) : (
        <p className="mt-8 text-center font-sans text-sm font-medium text-muted">
          {copy.surveysEmpty}
        </p>
      )}

      <div className="mt-2">
        <DeviceTestReset />
      </div>

      <CustomerAuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSaved={(next) => {
          setProfile(next);
          chooseIdentity({ nickname: next.name, avatar: player.avatar });
        }}
      />
    </section>
  );
}

function EventsRaceCard({
  tenantId,
  gameType,
  href,
  copy,
  medals = false,
}: {
  tenantId: string;
  gameType: ArcadeScoreGame;
  href: string;
  copy: {
    kicker: string;
    title: string;
    cta: string;
    loading: string;
    empty: string;
    points: string;
  };
  medals?: boolean;
}) {
  const [entries, setEntries] = useState<QuizLeaderboardEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetchQuizLeaderboard(tenantId, undefined, gameType).then((result) => {
      if (active) setEntries(result.filter((entry) => entry.rank <= 5).slice(0, 5));
    });
    return () => {
      active = false;
    };
  }, [gameType, tenantId]);

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--btn-primary)] text-[var(--btn-text)]">
          <Trophy className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-sans text-[11px] font-black uppercase tracking-wider text-[var(--text-headline)]">
            {copy.kicker}
          </p>
          <p className="mt-0.5 font-sans text-sm font-extrabold tracking-tight text-[var(--text-headline)]">
            {copy.title}
          </p>
        </div>
      </div>

      {entries == null ? (
        <p className="mt-4 text-center font-sans text-sm font-medium text-[var(--text-body)]">
          {copy.loading}
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-center font-sans text-sm font-medium text-[var(--text-body)]">
          {copy.empty}
        </p>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {entries.map((entry) => (
            <li
              key={entry.clientId}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-2xl border border-[var(--border)] bg-black/20 px-3 py-2"
            >
              <span className="flex items-center justify-center font-sans text-xs font-black tabular-nums text-[var(--text-headline)]">
                {medals ? <RankMedal rank={entry.rank} /> : `#${entry.rank}`}
              </span>
              <span className="min-w-0 truncate font-sans text-sm font-semibold text-[var(--text-headline)]">
                {entry.nickname}
              </span>
              <span className="font-sans text-xs font-bold tabular-nums text-[var(--text-body)]">
                {copy.points.replace("{score}", String(entry.score))}
              </span>
            </li>
          ))}
        </ol>
      )}

      <Link
        href={href}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--btn-primary)] px-4 py-3 font-sans text-sm font-extrabold text-[var(--btn-text)] shadow-sm transition hover:brightness-95 active:scale-95"
      >
        {copy.cta}
      </Link>
    </section>
  );
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="size-4 text-[var(--btn-primary)]" aria-label="#1" />;
  }
  if (rank === 2) {
    return <Medal className="size-4 text-[var(--text-headline)]" aria-label="#2" />;
  }
  if (rank === 3) {
    return <Award className="size-4 text-[var(--accent)]" aria-label="#3" />;
  }
  return <span>#{rank}</span>;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
      <path
        fill="currentColor"
        d="M21.35 11.1H12.2v2.9h5.27c-.23 1.24-1.4 3.64-5.27 3.64-3.18 0-5.77-2.63-5.77-5.87s2.59-5.87 5.77-5.87c1.81 0 3.03.77 3.72 1.43l2.02-1.95C16.7 3.9 14.66 3 12.2 3 7.36 3 3.5 6.92 3.5 11.77S7.36 20.54 12.2 20.54c5.05 0 8.38-3.55 8.38-8.54 0-.57-.06-1-.13-.9Z"
      />
    </svg>
  );
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden>
      <rect
        x="3.25"
        y="3.25"
        width="17.5"
        height="17.5"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.15" cy="6.85" r="1" fill="currentColor" />
    </svg>
  );
}

