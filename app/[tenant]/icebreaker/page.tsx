"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GameContainer } from "@/components/GameContainer";
import { GuestProviders } from "@/components/GuestProviders";
import { PerkDrawer } from "@/components/PerkDrawer";
import { TalkDeck } from "@/components/TalkDeck";
import { tenantConfig, type TalkFlagVote } from "@/config/tenant.config";
import { getActiveTenantId, getCampaignSettings } from "@/lib/campaignState";

export default function IcebreakerPage() {
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const router = useRouter();
  const firstCategory = tenantConfig.talk.categories[0]?.id ?? "first-look";
  const [categoryId, setCategoryId] = useState(firstCategory);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [votes, setVotes] = useState<Record<string, TalkFlagVote>>({});
  const [perkOpen, setPerkOpen] = useState(false);

  const goHome = useCallback(() => {
    router.push(`/${tenantId}`);
  }, [router, tenantId]);

  const openPerk = useCallback(() => {
    if (!getCampaignSettings().active) return;
    setPerkOpen(true);
  }, []);

  return (
    <GuestProviders tenantId={tenantId} extraActive>
      <GameContainer
        title={tenantConfig.copy.landing.showcase.talkTitle}
        onBack={goHome}
      >
        <TalkDeck
          showModes
          categoryId={categoryId}
          index={index}
          answers={answers}
          votes={votes}
          onIndex={setIndex}
          onAnswer={(promptId, text) =>
            setAnswers((current) => ({ ...current, [promptId]: text }))
          }
          onVote={(promptId, vote) =>
            setVotes((current) => ({ ...current, [promptId]: vote }))
          }
          onHome={goHome}
          onChooseCategory={(next) => {
            setCategoryId(next);
            setIndex(0);
          }}
          onPickMood={() => {
            setCategoryId(firstCategory);
            setIndex(0);
          }}
          onClaim={openPerk}
        />
      </GameContainer>
      {perkOpen ? (
        <PerkDrawer key="perk-drawer" onClose={() => setPerkOpen(false)} />
      ) : null}
    </GuestProviders>
  );
}
