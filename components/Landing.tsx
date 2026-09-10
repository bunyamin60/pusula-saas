"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { BrandWordmark } from "@/components/BrandWordmark";
import { SocialLinks } from "@/components/SocialLinks";
import { DeviceTestReset } from "@/components/DeviceTestReset";
import { DuelLobbyDrawer } from "@/components/DuelLobby";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import {
  compassTitleOf,
  isLoungeVenue,
  resolveLandingCopy,
} from "@/lib/landingCopy";
import { useCampaign } from "@/lib/useCampaign";

type LandingProps = {
  onStartCompass: () => void;
  onStartTalk: () => void;
  onOpenReward?: () => void;
};

export function Landing({ onStartCompass, onStartTalk, onOpenReward }: LandingProps) {
  const defaults = tenantConfig.copy.landing;
  const duelCopy = tenantConfig.copy.duel;
  const campaign = useCampaign();
  const lounge = isLoungeVenue({ category: campaign.category });
  const compassTitle = compassTitleOf(campaign.category);
  const { kicker, greeting, accent, subhead } = resolveLandingCopy(campaign);
  const { ready: duelReady, inMatch } = useDuel();
  const [isDuelOpen, setIsDuelOpen] = useState(false);
  const [wasInMatch, setWasInMatch] = useState(inMatch);

  if (inMatch !== wasInMatch) {
    setWasInMatch(inMatch);
    if (inMatch) setIsDuelOpen(false);
  }

  return (
    <section className="flex flex-1 flex-col">
      <p className="landing-badge">
        <span className="landing-badge-dot" aria-hidden />
        {kicker}
      </p>

      <div className="relative mt-6 flex flex-1 flex-col items-center">
        <div className="pointer-events-none absolute left-1/2 top-2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="steam" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <BrandWordmark />
      </div>

      <div className="mt-auto space-y-5 pb-2 pt-6">
        <div className="space-y-3 text-center">
          <h1 className="landing-headline-block font-display text-[1.85rem] leading-tight text-ink">
            <AccentTitle text={greeting} accent={accent} />
          </h1>
          <p className="landing-subhead text-[15px] leading-relaxed text-muted">
            {subhead}
          </p>
        </div>

        {onOpenReward ? (
          <button
            type="button"
            onClick={onOpenReward}
            className="btn-secondary w-full"
          >
            {defaults.openReward}
          </button>
        ) : null}

        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
          {defaults.chooseLead}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onStartCompass}
            className="flex min-h-[5.75rem] w-full items-start gap-3 rounded-2xl bg-primary px-4 py-4 text-left text-on-primary shadow-lift transition-transform active:scale-[0.99]"
          >
            <span className="mt-0.5 flex shrink-0 items-center justify-center" aria-hidden>
              {lounge ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7 flex-shrink-0 text-black"
                >
                  <path d="M10 2h4" />
                  <path d="M11 2v2" />
                  <path d="M13 2v2" />
                  <path d="M8 5h8" />
                  <path d="M12 5v6" />
                  <path d="M9.5 11h5l2.2 7a2 2 0 0 1-1.9 2.5H9.2a2 2 0 0 1-1.9-2.5L9.5 11z" />
                  <path d="M12 8c3.5 0 6 2 6 5.5v4" />
                  <path d="M18 17.5v1.5" />
                </svg>
              ) : (
                defaults.compassIcon
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-xl leading-tight">
                {compassTitle}
              </span>
              <span className="mt-1 block text-sm leading-snug text-on-primary/80">
                {campaign.hook || defaults.compassCaption}
              </span>
            </span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onStartTalk}
              className={`flex min-h-[6rem] flex-col items-start gap-1 rounded-2xl bg-surface px-3.5 py-3.5 text-left shadow-sm transition-transform active:scale-[0.99] ${
                duelReady ? "" : "col-span-2"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {defaults.talkIcon}
              </span>
              <span className="font-display text-base leading-tight text-ink">
                {defaults.talkTitle}
              </span>
              <span className="line-clamp-2 text-[11px] leading-snug text-muted">
                {defaults.talkCaption}
              </span>
            </button>
            {duelReady ? (
              <button
                type="button"
                onClick={() => setIsDuelOpen(true)}
                className="relative flex min-h-[6rem] flex-col items-start gap-1 rounded-2xl bg-surface px-3.5 py-3.5 text-left shadow-sm transition-transform active:scale-[0.99]"
              >
                <span className="absolute right-3 top-3 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                  {duelCopy.liveBadge}
                </span>
                <span className="text-2xl" aria-hidden>
                  {defaults.duelIcon}
                </span>
                <span className="font-display text-base leading-tight text-ink">
                  {defaults.duelTitle}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        <SocialLinks variant="landing" />

        <p className="text-center text-xs tracking-wide text-muted">
          {defaults.footnote}
        </p>
        <DeviceTestReset />
      </div>

      <AnimatePresence>
        {isDuelOpen ? (
          <DuelLobbyDrawer onClose={() => setIsDuelOpen(false)} />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function AccentTitle({ text, accent }: { text: string; accent: string }) {
  const index = accent ? text.indexOf(accent) : -1;

  if (index === -1) {
    return (
      <>
        {text}
        {accent ? (
          <>
            {" "}
            <span className="text-primary">{accent}</span>
          </>
        ) : null}
      </>
    );
  }

  return (
    <>
      {text.slice(0, index)}
      <span className="text-primary">{text.slice(index, index + accent.length)}</span>
      {text.slice(index + accent.length)}
    </>
  );
}
