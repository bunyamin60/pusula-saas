"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, ChevronLeft, Medal, Trophy } from "lucide-react";
import { ArcadeGameCard } from "@/components/ArcadeGameCard";
import { useAppLoading } from "@/components/AppLoadingProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { DailyQuestionFeed } from "@/components/DailyQuestionFeed";
import { DeviceTestReset } from "@/components/DeviceTestReset";
import { GuestAvatarImage } from "@/components/GuestAvatarImage";
import { LoyaltyStampCard } from "@/components/LoyaltyStampCard";
import { RewardProgressBar } from "@/components/RewardProgressBar";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { arcadeGameCopy, featuredArcadeGames } from "@/lib/gameCatalog";
import {
  entryAvatarSrc,
  fetchQuizLeaderboard,
  type ArcadeScoreGame,
  type QuizLeaderboardEntry,
} from "@/lib/duelLeaderboard";
import { resolveLogoUrl } from "@/lib/tenant";
import { getActiveTableLabel } from "@/lib/tableSession";
import { useCampaign } from "@/lib/useCampaign";
import {
  clearLobbyRaceFocus,
  LOBBY_TAB_EVENT,
  readLobbyRaceFocus,
  readLobbyTab,
  type LobbyRaceFocus,
  type LobbyTab,
  type VenueHomeView,
} from "@/lib/venueHome";
import { quizCategoryTitle, type QuizCategoryId } from "@/lib/quizBank";

const QUIZ_RACE_CATEGORIES = [
  "cafe",
  "turkey",
  "general",
  "sports",
] as const satisfies readonly QuizCategoryId[];

export function Landing({
  view,
  onEnterLobby,
  onBackWelcome,
}: {
  view: VenueHomeView;
  onEnterLobby: () => void;
  onBackWelcome: () => void;
}) {
  return (
    <div key={view} className="flex min-h-0 flex-1 flex-col overflow-hidden venue-enter">
      {view === "welcome" ? (
        <WelcomeScreen onEnterLobby={onEnterLobby} />
      ) : (
        <GameLobby onBackWelcome={onBackWelcome} />
      )}
      <style>{`
        @keyframes venueEnter {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .venue-enter { animation: venueEnter 280ms ease-out; }
      `}</style>
    </div>
  );
}

function WelcomeScreen({ onEnterLobby }: { onEnterLobby: () => void }) {
  const copy = tenantConfig.copy.landing;
  const campaign = useCampaign();
  const { tenantId } = useDuel();
  const brand = (campaign.brandName || tenantConfig.brand.name).trim();
  const logoUrl =
    resolveLogoUrl(campaign.logoUrl, tenantId) || tenantConfig.brand.logoUrl;
  const instagram = campaign.instagramUrl || tenantConfig.reward.instagramUrl;
  const instagramHandle = instagramHandleFromUrl(instagram);
  const instagramLabel = instagramHandle
    ? copy.instagramHandle.replace("{handle}", instagramHandle)
    : copy.instagramChip;
  const tableLabel = getActiveTableLabel(tenantId).trim();

  return (
    <section className="flex min-h-0 flex-1 flex-col justify-between px-6 pb-6">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
        <BrandLogo src={logoUrl} alt={brand} size="hero" />
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-[var(--text-headline)]">
          {brand}
        </h1>
        <p className="mx-auto max-w-[20rem] font-sans text-sm font-medium leading-snug text-[var(--text-body)]">
          {copy.welcomeLead}
        </p>
        {tableLabel ? (
          <span className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] bg-[var(--card-surface)] px-4 py-1.5 font-sans text-sm font-bold text-[var(--text-headline)]">
            {tableLabel}
          </span>
        ) : null}
        {instagram ? (
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-surface)] px-4 py-2.5 font-sans text-sm font-bold text-[var(--text-headline)] transition hover:brightness-95 active:scale-95"
          >
            <InstagramMark />
            {instagramLabel}
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onEnterLobby}
        className="mt-6 w-full shrink-0 rounded-2xl bg-[var(--btn-primary)] py-4 font-sans text-lg font-extrabold text-[var(--btn-text)] shadow-lg transition hover:brightness-95 active:scale-95"
      >
        {copy.playCta}
      </button>
    </section>
  );
}

function GameLobby({ onBackWelcome }: { onBackWelcome: () => void }) {
  const copy = tenantConfig.copy.landing;
  const campaign = useCampaign();
  const router = useRouter();
  const { tenantId, player } = useDuel();
  const [tab, setTab] = useState<LobbyTab>(() => readLobbyTab(tenantId));
  const [raceFocus, setRaceFocus] = useState<LobbyRaceFocus | null>(null);
  const brand = (campaign.brandName || tenantConfig.brand.name).trim();
  const logoUrl =
    resolveLogoUrl(campaign.logoUrl, tenantId) || tenantConfig.brand.logoUrl;
  const visible = featuredArcadeGames(campaign.enabledGames);

  useEffect(() => {
    setTab(readLobbyTab(tenantId));
    const focus = readLobbyRaceFocus(tenantId);
    setRaceFocus(focus);
    if (focus) clearLobbyRaceFocus(tenantId);
  }, [tenantId]);

  useEffect(() => {
    function onTab(event: Event) {
      const detail = (event as CustomEvent<{ tenantId: string; tab: LobbyTab }>)
        .detail;
      if (!detail || detail.tenantId !== tenantId) return;
      setTab(detail.tab);
      setRaceFocus(null);
    }
    window.addEventListener(LOBBY_TAB_EVENT, onTab);
    return () => window.removeEventListener(LOBBY_TAB_EVENT, onTab);
  }, [tenantId]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex w-full shrink-0 items-center justify-between gap-3 bg-[var(--bg-canvas)] px-5 pb-2 pt-1">
        <button
          type="button"
          onClick={onBackWelcome}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-surface)] text-[var(--text-headline)] transition hover:brightness-95 active:scale-95"
          aria-label={copy.welcomeBack}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <BrandLogo src={logoUrl} alt={brand} size="header" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 pb-2">
        <RewardProgressBar compact />

        <div className="mt-3">
          <DailyQuestionFeed tenantId={tenantId} clientId={player.clientId} />
        </div>

        {tab === "games" ? (
          <div className="mt-3 space-y-3 pb-3">
            <div className="grid grid-cols-2 gap-3">
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
          </div>
        ) : tab === "events" ? (
          <div className="mt-3 space-y-4">
            {raceFocus === "blockblast" ? (
              <>
                <EventsRaceCard
                  tenantId={tenantId}
                  gameType="blockblast"
                  href={`/${tenantId}/blockblast`}
                  copy={copy.blastRace}
                  medals
                  focus
                />
                <EventsRaceCard
                  tenantId={tenantId}
                  gameType="quiz"
                  href={`/${tenantId}/trivia`}
                  copy={copy.race}
                  categoryTabs
                />
              </>
            ) : (
              <>
                <EventsRaceCard
                  tenantId={tenantId}
                  gameType="quiz"
                  href={`/${tenantId}/trivia`}
                  copy={copy.race}
                  categoryTabs
                  focus={raceFocus === "quiz"}
                />
                <EventsRaceCard
                  tenantId={tenantId}
                  gameType="blockblast"
                  href={`/${tenantId}/blockblast`}
                  copy={copy.blastRace}
                  medals
                />
              </>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <LoyaltyStampCard
              tenantId={tenantId}
              clientId={player.clientId}
              tableId={getActiveTableLabel(tenantId)}
            />
          </div>
        )}

        <div className="mt-2">
          <DeviceTestReset />
        </div>
      </div>
    </section>
  );
}

function EventsRaceCard({
  tenantId,
  gameType,
  href,
  copy,
  medals = false,
  categoryTabs = false,
  focus = false,
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
  categoryTabs?: boolean;
  focus?: boolean;
}) {
  const router = useRouter();
  const { runWithSlowGuard } = useAppLoading();
  const cardRef = useRef<HTMLElement>(null);
  const [category, setCategory] = useState<QuizCategoryId>("cafe");
  const [entries, setEntries] = useState<QuizLeaderboardEntry[] | null>(null);
  const [spotlight, setSpotlight] = useState(false);

  useEffect(() => {
    let active = true;
    void runWithSlowGuard(() =>
      fetchQuizLeaderboard(
        tenantId,
        undefined,
        gameType,
        categoryTabs ? category : null,
      ),
    ).then((result) => {
      if (active) setEntries(result.filter((entry) => entry.rank <= 5).slice(0, 5));
    });
    return () => {
      active = false;
    };
  }, [category, categoryTabs, gameType, runWithSlowGuard, tenantId]);

  useEffect(() => {
    if (!focus || !cardRef.current) return;
    const node = cardRef.current;
    const frame = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setSpotlight(true);
    });
    const clear = window.setTimeout(() => setSpotlight(false), 1600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clear);
    };
  }, [focus]);

  return (
    <section
      ref={cardRef}
      className={`rounded-3xl border bg-[var(--card-surface)] p-5 shadow-sm transition-[box-shadow,border-color] duration-500 ${
        spotlight
          ? "border-[var(--btn-primary)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--btn-primary)_28%,transparent)]"
          : "border-[var(--border)]"
      }`}
    >
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

      {categoryTabs ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {QUIZ_RACE_CATEGORIES.map((id) => {
            const active = category === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`min-h-10 rounded-xl border px-2 py-2 font-sans text-[11px] font-bold transition active:scale-95 ${
                  active
                    ? "border-[var(--btn-primary)] bg-[var(--btn-primary)] text-[var(--btn-text)]"
                    : "border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-headline)]"
                }`}
              >
                {quizCategoryTitle(id)}
              </button>
            );
          })}
        </div>
      ) : null}

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
          {entries.map((entry) => {
            const avatarSrc = entryAvatarSrc(entry);
            return (
              <li
                key={entry.clientId}
                className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2"
              >
                <span className="flex items-center justify-center font-sans text-xs font-black tabular-nums text-[var(--text-headline)]">
                  {medals ? <RankMedal rank={entry.rank} /> : `#${entry.rank}`}
                </span>
                {avatarSrc ? (
                  <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-[var(--border)]">
                    <GuestAvatarImage src={avatarSrc} sizes="32px" />
                  </span>
                ) : (
                  <span className="size-8 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 truncate font-sans text-sm font-semibold text-[var(--text-headline)]">
                  {entry.nickname}
                </span>
                <span className="font-sans text-xs font-bold tabular-nums text-[var(--text-body)]">
                  {copy.points.replace("{score}", String(entry.score))}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={() => router.push(href)}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--btn-primary)] px-4 py-3 font-sans text-sm font-extrabold text-[var(--btn-text)] shadow-sm transition hover:brightness-95 active:scale-95"
      >
        {copy.cta}
      </button>
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

function instagramHandleFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "instagram.com" && host !== "instagr.am") return null;
    const skip = new Set(["p", "reel", "reels", "stories", "explore", "accounts"]);
    const handle = parsed.pathname
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)
      .find((part) => !skip.has(part.toLowerCase()));
    if (!handle) return null;
    return handle.replace(/^@/, "");
  } catch {
    return null;
  }
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
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
