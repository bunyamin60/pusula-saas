"use client";

import { useEffect, useRef, useState } from "react";
import { ExperienceBack } from "@/components/ExperienceBack";
import { OptionIcon } from "@/components/OptionIcon";
import { tenantConfig, type CompassOption, type Recipe } from "@/config/tenant.config";
import { matchRecipe } from "@/lib/matchRecipe";
import {
  optionDescOf,
  optionMatchesChoice,
  optionTagOf,
  questionTitleOf,
} from "@/lib/campaignState";
import { compassTitleOf, resolveTenantCategory } from "@/lib/landingCopy";
import { useCampaign } from "@/lib/useCampaign";

type CompassProps = {
  initialAnswers?: Record<string, string>;
  initialIndex?: number;
  onProgress?: (answers: Record<string, string>, index: number) => void;
  onComplete: (answers: Record<string, string>, recipe: Recipe) => void;
  onHome?: () => void;
};

export function Compass({
  initialAnswers = {},
  initialIndex = 0,
  onProgress,
  onComplete,
  onHome,
}: CompassProps) {
  const campaign = useCampaign();
  const questions = campaign.questions;
  const copy = tenantConfig.copy.compass;
  const category = resolveTenantCategory(campaign.category);
  const eyebrow =
    (copy.eyebrowByCategory as Record<string, string>)[category] ??
    compassTitleOf(category);
  const [index, setIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [picked, setPicked] = useState<string | null>(
    () => initialAnswers[questions[initialIndex]?.id] ?? null,
  );
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const question = questions[index];
  const total = Math.max(questions.length, 1);
  const progress = ((index + (picked ? 1 : 0)) / total) * 100;

  function clearTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function goBack() {
    if (leaving || index === 0) return;
    clearTimer();
    const prevIndex = index - 1;
    const prevQuestion = questions[prevIndex];
    setIndex(prevIndex);
    setPicked(answers[prevQuestion.id] ?? null);
    setLeaving(false);
    onProgress?.(answers, prevIndex);
  }

  function choose(option: CompassOption) {
    if (leaving) return;
    const choice = optionTagOf(option);
    if (!choice) return;
    setPicked(choice);

    const nextAnswers = { ...answers, [question.id]: choice };
    if (answers[question.id] && answers[question.id] !== choice) {
      for (let next = index + 1; next < total; next += 1) {
        delete nextAnswers[questions[next].id];
      }
    }
    setAnswers(nextAnswers);
    setLeaving(true);

    const nextIndex = index + 1;
    if (nextIndex >= total) {
      timerRef.current = window.setTimeout(() => {
        onComplete(nextAnswers, matchRecipe(nextAnswers, campaign));
      }, 340);
      return;
    }

    onProgress?.(nextAnswers, nextIndex);
    timerRef.current = window.setTimeout(() => {
      setIndex(nextIndex);
      setPicked(nextAnswers[questions[nextIndex].id] ?? null);
      setLeaving(false);
    }, 340);
  }

  const progressLabel = copy.progressTemplate
    .replace("{current}", String(Math.min(index + 1, questions.length)))
    .replace("{total}", String(questions.length));

  if (!question) return null;

  return (
    <section className="flex flex-1 flex-col">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
          <p className="text-xs text-muted">{progressLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {index > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              ← {copy.back}
            </button>
          ) : onHome ? (
            <ExperienceBack onBack={onHome} />
          ) : null}
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className={`mt-10 flex flex-1 flex-col transition-all duration-300 ${
          leaving ? "-translate-x-4 opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <h2 className="font-display text-[1.85rem] leading-tight text-ink">
          {questionTitleOf(question)}
        </h2>

        <div className="mt-8 grid gap-3">
          {question.options.map((option) => {
            const selected = optionMatchesChoice(option, picked);
            return (
              <button
                key={option.id || optionTagOf(option)}
                type="button"
                onClick={() => choose(option)}
                className={`group flex min-h-[6.25rem] items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                  selected
                    ? "border-primary bg-primary text-on-primary shadow-lift"
                    : "border-transparent bg-surface text-ink hover:border-primary/30 active:scale-[0.99]"
                }`}
              >
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                    selected ? "bg-on-primary/15 text-on-primary" : "bg-background text-primary"
                  }`}
                >
                  <OptionIcon
                    option={option}
                    category={category}
                    className="size-5"
                    color={
                      selected ? undefined : campaign.themeConfig.primary
                    }
                  />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-xl leading-tight">
                    {option.label}
                  </span>
                  <span
                    className={`mt-1 block text-sm leading-snug ${
                      selected ? "text-on-primary/80" : "text-muted"
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
    </section>
  );
}
