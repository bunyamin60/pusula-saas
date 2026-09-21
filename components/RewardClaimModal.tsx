"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { OptionIcon } from "@/components/OptionIcon";
import { usePlayReward } from "@/components/PlayRewardProvider";
import { tenantConfig, type CompassOption, type Recipe } from "@/config/tenant.config";
import {
  optionDescOf,
  optionTagOf,
  pusulaFunnelEnabled,
  questionTitleOf,
} from "@/lib/campaignState";
import { matchRecipe } from "@/lib/matchRecipe";
import { getPlayRewardRecipe, makePlayRewardCode } from "@/lib/playReward";
import { useCampaign } from "@/lib/useCampaign";

type ClaimStep = "congrats" | "compass" | "result";

export function RewardClaimModal() {
  const copy = tenantConfig.copy.playReward;
  const campaign = useCampaign();
  const questions =
    campaign.questions.length > 0
      ? campaign.questions
      : tenantConfig.playReward.questions;
  const funnelOn = pusulaFunnelEnabled(campaign.enabledGames);
  const { claimOpen, closeClaim, claimedCode, redeemedAt, recipeId, sealClaim, targetMinutes } =
    usePlayReward();
  const sealedRecipe = getPlayRewardRecipe(recipeId);
  const [step, setStep] = useState<ClaimStep>("congrats");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recipe, setRecipe] = useState<Recipe | null>(sealedRecipe);
  const [code, setCode] = useState(claimedCode);
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!claimOpen) return;
    if (claimedCode) {
      setStep("result");
      setCode(claimedCode);
      setRecipe(getPlayRewardRecipe(recipeId));
      return;
    }
    setStep("congrats");
    setIndex(0);
    setAnswers({});
    setRecipe(null);
    setCode(null);
  }, [claimOpen, claimedCode, recipeId, funnelOn, sealClaim]);

  useEffect(() => {
    if (!claimOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [claimOpen]);

  const question = questions[index];
  const progressLabel = copy.questionProgress
    .replace("{current}", String(Math.min(index + 1, questions.length)))
    .replace("{total}", String(questions.length));

  const result = useMemo(() => {
    if (step !== "result") return null;
    return recipe ?? sealedRecipe;
  }, [recipe, sealedRecipe, step]);

  function showCashierCode() {
    const nextCode = claimedCode || makePlayRewardCode();
    sealClaim(nextCode, "campaign");
    setRecipe(null);
    setCode(nextCode);
    setStep("result");
  }

  function openCompass() {
    setIndex(0);
    setAnswers({});
    setStep("compass");
  }

  function choose(option: CompassOption) {
    if (!question) return;
    const choice = option.id || optionTagOf(option);
    const nextAnswers = { ...answers, [question.id]: choice };
    setAnswers(nextAnswers);
    const nextIndex = index + 1;
    if (nextIndex < questions.length) {
      setIndex(nextIndex);
      return;
    }
    const matched = matchRecipe(nextAnswers, campaign);
    const nextCode = claimedCode || makePlayRewardCode();
    sealClaim(nextCode, matched.id);
    setRecipe(matched);
    setCode(nextCode);
    setStep("result");
  }

  if (!mounted) return null;

  const resultTitle = result?.name || campaign.hook;
  const resultNote = result?.originNote || "";

  return createPortal(
    <AnimatePresence>
      {claimOpen ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            onClick={closeClaim}
            aria-label={copy.close}
            className="absolute inset-0 bg-ink/40"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="play-reward-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.72 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 650) {
                closeClaim();
              }
            }}
            className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-ink/15 bg-background shadow-lift"
          >
            <div
              className="shrink-0 touch-none px-5 pb-1 pt-3"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-surface" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                {step === "compass" ? (
                  <p className="font-sans text-xs font-medium tabular-nums text-muted">
                    {progressLabel}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeClaim}
                aria-label={copy.close}
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-ink/20 bg-background text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            {step === "congrats" ? (
              <div className="pb-2 pt-2">
                <h2
                  id="play-reward-title"
                  className="font-sans text-2xl font-extrabold leading-tight tracking-tight text-ink"
                >
                  {copy.congratsTitle}
                </h2>
                <p className="mt-3 font-sans text-sm font-medium leading-relaxed text-muted">
                  {copy.congratsBody.replace("{minutes}", String(targetMinutes))}
                </p>
                <button
                  type="button"
                  onClick={showCashierCode}
                  className="btn-primary mt-6 w-full"
                >
                  {copy.skipFunnelCta}
                </button>
                {funnelOn ? (
                  <button
                    type="button"
                    onClick={openCompass}
                    className="btn-secondary mt-2.5 w-full"
                  >
                    {copy.startCompass}
                  </button>
                ) : null}
              </div>
            ) : null}

            {step === "compass" && question ? (
              <div className="pb-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (index === 0) {
                      setStep(code ? "result" : "congrats");
                      return;
                    }
                    setIndex(index - 1);
                  }}
                  className="mb-3 inline-flex min-h-12 items-center font-sans text-sm font-semibold text-muted active:scale-95"
                >
                  ← {copy.back}
                </button>
                <h2
                  id="play-reward-title"
                  className="font-sans text-[1.65rem] font-extrabold leading-tight tracking-tight text-ink"
                >
                  {questionTitleOf(question)}
                </h2>
                <div className="mt-5 grid gap-2.5">
                  {question.options.map((option) => {
                    const selected =
                      answers[question.id] === (option.id || optionTagOf(option));
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => choose(option)}
                        className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3.5 text-left font-sans font-bold shadow-sm transition hover:brightness-95 active:scale-95 ${
                          selected
                            ? "border-ink/15 bg-surface text-ink"
                            : "border-transparent bg-primary text-on-primary"
                        }`}
                      >
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                            selected
                              ? "bg-background text-ink"
                              : "bg-ink/10 text-on-primary"
                          }`}
                        >
                          <OptionIcon option={option} className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-sans text-lg font-extrabold leading-tight tracking-tight">
                            {option.label}
                          </span>
                          <span
                            className={`mt-0.5 block font-sans text-sm font-medium leading-snug ${
                              selected ? "text-muted" : "text-on-primary/80"
                            }`}
                          >
                            {optionDescOf(option)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === "result" && code ? (
              <div className="pb-2 pt-1 text-center">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {result ? copy.resultEyebrow : copy.directEyebrow}
                </p>
                <h2
                  id="play-reward-title"
                  className="mt-2 font-sans text-2xl font-extrabold leading-tight tracking-tight text-ink"
                >
                  {resultTitle}
                </h2>
                {resultNote ? (
                  <p className="mt-2 font-sans text-sm font-medium text-muted">{resultNote}</p>
                ) : null}
                {funnelOn && result && !redeemedAt ? (
                  <button
                    type="button"
                    onClick={openCompass}
                    className="btn-secondary mt-4 w-full"
                  >
                    {copy.resultCompassAgainCta}
                  </button>
                ) : null}
                <div className="relative mt-5 overflow-hidden rounded-3xl border border-ink/15 bg-primary px-4 py-5">
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-on-primary">
                    {copy.couponLabel}
                  </p>
                  <p className="mt-2 font-mono text-3xl font-black tracking-[0.14em] text-on-primary">
                    {code}
                  </p>
                  {redeemedAt ? (
                    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-xl border-4 border-red-500/90 px-4 py-2 font-sans text-2xl font-black uppercase tracking-[0.18em] text-red-500">
                      {copy.couponUsedStamp}
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 font-sans text-sm font-medium leading-relaxed text-muted">
                  {redeemedAt ? copy.couponUsedBody : copy.couponHint}
                </p>
                {funnelOn && !result && !redeemedAt ? (
                  <div className="mt-5">
                    <p className="mb-2.5 font-sans text-sm font-semibold text-[var(--text-body)]">
                      {copy.resultCompassLead}
                    </p>
                    <button
                      type="button"
                      onClick={openCompass}
                      className="btn-primary w-full"
                    >
                      {copy.resultCompassCta}
                    </button>
                  </div>
                ) : null}
                <GoogleOptionalLink />
                <button
                  type="button"
                  onClick={closeClaim}
                  className="btn-secondary mt-5 w-full"
                >
                  {copy.close}
                </button>
              </div>
            ) : null}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function GoogleOptionalLink() {
  const copy = tenantConfig.copy.playReward;
  const campaign = useCampaign();
  const href = campaign.googleReviewUrl || tenantConfig.reward.googleReviewUrl;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-[var(--border)] bg-[var(--card-surface)] px-4 py-2.5 font-sans text-xs font-bold text-[var(--text-headline)] transition hover:brightness-95 active:scale-95"
    >
      <GoogleMark />
      {copy.googleOptional}
    </a>
  );
}

function GoogleMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}
