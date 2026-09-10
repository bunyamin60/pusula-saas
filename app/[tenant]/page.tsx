"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { CoffeeLoader } from "@/components/CoffeeLoader";
import { Compass } from "@/components/Compass";
import { DuelProvider } from "@/components/DuelProvider";
import { Landing } from "@/components/Landing";
import { MatchReveal } from "@/components/MatchReveal";
import { PerkDrawer } from "@/components/PerkDrawer";
import { TalkDeck } from "@/components/TalkDeck";
import { TalkPick } from "@/components/TalkPick";
import { BrandWordmark } from "@/components/BrandWordmark";
import { type Recipe } from "@/config/tenant.config";
import { getRecipeById } from "@/lib/matchRecipe";
import { getActiveTenantId, getCampaignSettings } from "@/lib/campaignState";
import { useCampaign } from "@/lib/useCampaign";
import {
  getClientSession,
  getServerSession,
  subscribeToSession,
  updateSession,
} from "@/lib/session";

const SPLASH_MS = 1200;
const SPLASH_FADE_MS = 380;

export default function TenantHome() {
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const session = useSyncExternalStore(
    subscribeToSession,
    getClientSession,
    getServerSession,
  );
  const [splash, setSplash] = useState<"in" | "out" | "done">("in");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const hide = window.setTimeout(() => setSplash("out"), SPLASH_MS);
    return () => window.clearTimeout(hide);
  }, []);

  useEffect(() => {
    if (splash !== "out") return;
    const done = window.setTimeout(() => setSplash("done"), SPLASH_FADE_MS);
    return () => window.clearTimeout(done);
  }, [splash]);

  const persistProgress = useCallback(
    (nextAnswers: Record<string, string>, index: number) => {
      updateSession({ answers: nextAnswers, questionIndex: index });
    },
    [],
  );

  const goHome = useCallback(() => {
    updateSession({
      step: "landing",
      experience: undefined,
      talkCategoryId: null,
      talkIndex: 0,
      talkSurpriseSeen: false,
    });
  }, []);

  const startCompass = useCallback(() => {
    updateSession({
      step: "compass",
      experience: "compass",
      answers: {},
      questionIndex: 0,
      recipeId: null,
      talkCategoryId: null,
      talkIndex: 0,
      talkSurpriseSeen: false,
    });
  }, []);

  const startTalk = useCallback(() => {
    updateSession({
      step: "talk-pick",
      experience: "talk",
      talkCategoryId: null,
      talkIndex: 0,
      talkSurpriseSeen: false,
      talkAnswers: {},
      talkVotes: {},
    });
  }, []);

  const backToLastQuestion = useCallback(() => {
    const lastIndex = Math.max(0, getCampaignSettings().questions.length - 1);
    updateSession({
      step: "compass",
      questionIndex: lastIndex,
      recipeId: null,
      reward: null,
    });
  }, []);

  const resetQuiz = useCallback(() => {
    updateSession({
      step: "compass",
      answers: {},
      questionIndex: 0,
      recipeId: null,
      reward: null,
    });
  }, []);

  const finishCompass = useCallback(
    (nextAnswers: Record<string, string>, nextRecipe: Recipe) => {
      updateSession({
        answers: nextAnswers,
        recipeId: nextRecipe.id,
        step: "match",
      });
    },
    [],
  );

  const openPerk = useCallback(() => {
    if (!getCampaignSettings().active) return;
    setIsDrawerOpen(true);
  }, []);

  if (!session) {
    return (
      <Shell>
        <CoffeeLoader />
      </Shell>
    );
  }

  const rawStep =
    session.step === "game"
      ? session.experience === "talk"
        ? "talk-play"
        : "match"
      : session.step === "reward"
        ? session.recipeId
          ? "match"
          : "landing"
        : session.step;
  const step = rawStep;
  const recipe = getRecipeById(session.recipeId);

  const locked = step === "talk-play";

  return (
    <DuelProvider tenantId={tenantId}>
    <Shell locked={locked}>
      {splash !== "done" ? <CoffeeLoader fading={splash === "out"} /> : null}
      {step !== "landing" && <BrandWordmark compact home />}
      {step === "landing" && (
        <Landing onStartCompass={startCompass} onStartTalk={startTalk} />
      )}
      {step === "compass" && (
        <Compass
          key={`compass-${session.questionIndex}-${Object.keys(session.answers).length}`}
          initialAnswers={session.answers}
          initialIndex={session.questionIndex}
          onProgress={persistProgress}
          onComplete={finishCompass}
          onHome={goHome}
        />
      )}
      {step === "match" && recipe && (
        <MatchReveal
          recipe={recipe}
          onPlay={openPerk}
          onBackToLast={backToLastQuestion}
          onRestartCompass={resetQuiz}
        />
      )}
      {step === "talk-pick" && (
        <TalkPick
          onHome={goHome}
          onChoose={(categoryId) =>
            updateSession({
              step: "talk-play",
              experience: "talk",
              talkCategoryId: categoryId,
              talkIndex: 0,
              talkSurpriseSeen: false,
              talkAnswers: {},
              talkVotes: {},
            })
          }
        />
      )}
      {step === "talk-play" && session.talkCategoryId && (
        <TalkDeck
          categoryId={session.talkCategoryId}
          index={session.talkIndex ?? 0}
          answers={session.talkAnswers ?? {}}
          votes={session.talkVotes ?? {}}
          onIndex={(talkIndex) => updateSession({ talkIndex })}
          onAnswer={(promptId, text) =>
            updateSession({
              talkAnswers: { ...(session.talkAnswers ?? {}), [promptId]: text },
            })
          }
          onVote={(promptId, vote) =>
            updateSession({
              talkVotes: { ...(session.talkVotes ?? {}), [promptId]: vote },
            })
          }
          onHome={goHome}
          onPickMood={() =>
            updateSession({
              step: "talk-pick",
              talkCategoryId: null,
              talkIndex: 0,
            })
          }
          onClaim={openPerk}
        />
      )}
      <AnimatePresence>
        {isDrawerOpen ? (
          <PerkDrawer
            key="perk-drawer"
            productName={recipe?.name}
            onClose={() => setIsDrawerOpen(false)}
          />
        ) : null}
      </AnimatePresence>
      <span className="sr-only">{campaign.brandName}</span>
    </Shell>
    </DuelProvider>
  );
}

function Shell({
  children,
  locked = false,
}: {
  children: ReactNode;
  locked?: boolean;
}) {
  return (
    <main
      className={`mx-auto flex w-full max-w-md flex-col overflow-x-hidden bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] ${
        locked
          ? "h-dvh overflow-hidden overscroll-none"
          : "min-h-dvh"
      }`}
    >
      {children}
    </main>
  );
}
