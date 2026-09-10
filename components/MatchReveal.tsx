"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, RotateCcw } from "lucide-react";
import { ExperienceBack } from "@/components/ExperienceBack";
import { HookahAnimation } from "@/components/HookahAnimation";
import { InstagramIcon } from "@/components/SocialLinks";
import { DeviceTestReset } from "@/components/DeviceTestReset";
import { DuelExperience } from "@/components/DuelLobby";
import { tenantConfig, type Recipe } from "@/config/tenant.config";
import { logQuizCompleteOnce } from "@/lib/analytics";
import { getActiveTenantId } from "@/lib/campaignState";
import { isLoungeVenue, matchAsideLine, resolveTenantCategory } from "@/lib/landingCopy";
import { useCampaign } from "@/lib/useCampaign";
import { useParams } from "next/navigation";

type MatchRevealProps = {
  recipe: Recipe;
  onPlay: () => void;
  onBackToLast: () => void;
  onRestartCompass: () => void;
};

export function MatchReveal({
  recipe,
  onPlay,
  onBackToLast,
  onRestartCompass,
}: MatchRevealProps) {
  const copy = tenantConfig.copy.match;
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const tagline = recipe.tagline || recipe.originNote;
  const tastingNotes = recipe.tastingNotes ?? recipe.notes;
  const lounge = isLoungeVenue({ category: campaign.category });
  const aside = matchAsideLine(campaign.brandName, campaign.category);
  const category = resolveTenantCategory(campaign.category);
  const perkConditions = tenantConfig.copy.match.perkConditionByCategory as Record<
    string,
    string
  >;
  const perkCondition =
    perkConditions[category] ?? perkConditions.lounge ?? perkConditions.general;
  const cta = tenantConfig.copy.match.ctaOrder;
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    };
  }, []);

  useEffect(() => {
    logQuizCompleteOnce(tenantId, recipe.name);
  }, [recipe.name, tenantId]);

  function leaveTo(next: () => void) {
    if (leaving) return;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(next, 280);
  }

  return (
    <section className="flex flex-1 flex-col">
      <ExperienceBack
        onBack={() => leaveTo(onBackToLast)}
        label={copy.backToSelections}
      />
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${
          leaving ? "-translate-x-4 opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
        {copy.eyebrow}
      </p>

      <article className="mt-5 overflow-hidden rounded-2xl bg-surface">
        <h2 className="px-6 pt-5 text-center font-display text-[1.45rem] leading-tight text-ink">
          {copy.invite}
        </h2>
        <div className="flex justify-center px-6 pt-4">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt=""
              className="h-40 w-40 rounded-2xl object-cover shadow-lift"
            />
          ) : lounge ? (
            <HookahAnimation
              name={recipe.name}
              accentColor={recipe.accentColor}
            />
          ) : (
            <RecipeCup recipe={recipe} />
          )}
        </div>
        <div className="space-y-3 px-6 pb-5 pt-5 text-center">
          <h2 className="font-display text-[1.85rem] leading-tight text-ink">
            {recipe.name}
          </h2>
          {tagline ? <p className="text-sm text-muted">{tagline}</p> : null}
          {campaign.active ? (
            <p className="rounded-2xl bg-background px-4 py-3 text-sm leading-relaxed text-ink">
              {campaign.hook || copy.offer}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => leaveTo(onRestartCompass)}
          className="mx-auto mb-5 flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm text-muted underline decoration-primary/40 underline-offset-4 transition-colors hover:bg-background hover:text-ink"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {copy.restartSelections}
        </button>
      </article>

      {campaign.active && perkCondition ? (
        <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-center text-sm leading-relaxed text-ink">
          🎁 {copy.perkBadge}: {perkCondition}
        </p>
      ) : null}

      {tastingNotes.length > 0 ? (
      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {copy.notesLabel}
        </p>
        <ul className="mt-3 space-y-2">
          {tastingNotes.map((note) => (
            <li
              key={note}
              className="flex items-start gap-3 text-sm leading-relaxed text-ink"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {note}
            </li>
          ))}
        </ul>
      </div>
      ) : null}

      <div className="mt-auto space-y-3 pt-8">
        {campaign.active ? (
          <>
            <button type="button" onClick={onPlay} className="btn-primary w-full">
              {cta}
            </button>
            <p className="text-center text-xs text-muted">{aside}</p>
          </>
        ) : (
          <p className="rounded-2xl bg-surface px-4 py-5 text-center text-sm leading-relaxed text-muted">
            {copy.inactiveNote}
          </p>
        )}
        <DuelExperience />
        <MatchSocialIcons
          instagramUrl={campaign.instagramUrl || tenantConfig.reward.instagramUrl}
          mapsUrl={campaign.googleReviewUrl || tenantConfig.reward.googleReviewUrl}
          instagramLabel={copy.socialInstagram}
          mapsLabel={copy.socialMaps}
        />
        <DeviceTestReset />
      </div>
      </div>
    </section>
  );
}

function MatchSocialIcons({
  instagramUrl,
  mapsUrl,
  instagramLabel,
  mapsLabel,
}: {
  instagramUrl?: string;
  mapsUrl?: string;
  instagramLabel: string;
  mapsLabel: string;
}) {
  if (!instagramUrl && !mapsUrl) return null;
  return (
    <div className="flex items-center justify-center gap-2.5 pt-2">
      {instagramUrl ? (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={instagramLabel}
          className="flex size-9 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <InstagramIcon className="size-4" />
        </a>
      ) : null}
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={mapsLabel}
          className="flex size-9 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <MapPin className="size-4" />
        </a>
      ) : null}
    </div>
  );
}

function RecipeCup({ recipe }: { recipe: Recipe }) {
  return (
    <div className="relative h-36 w-28" aria-hidden>
      {recipe.visual.iced ? (
        <div className="absolute -right-1 top-8 size-3 rotate-12 rounded-sm bg-white/70" />
      ) : (
        <div className="steam steam-sm">
          <span />
          <span />
          <span />
        </div>
      )}
      <div className="absolute inset-x-2 top-4 h-28">
        <div
          className="absolute inset-0 rounded-[1.4rem] rounded-b-[2rem] border-[3px] border-ink/15"
          style={{ background: recipe.visual.liquid }}
        />
        <div
          className="absolute inset-x-1 top-1 h-6 rounded-full opacity-90"
          style={{ background: recipe.visual.foam }}
        />
        {recipe.visual.iced && (
          <>
            <div className="absolute left-3 top-10 h-4 w-3 rotate-12 rounded-sm bg-white/50" />
            <div className="absolute right-4 top-14 h-5 w-3.5 -rotate-6 rounded-sm bg-white/40" />
          </>
        )}
      </div>
      <div className="absolute bottom-1 left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-ink/10" />
    </div>
  );
}
