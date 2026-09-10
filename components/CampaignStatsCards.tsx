"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { tenantConfig } from "@/config/tenant.config";
import {
  fetchCampaignEvents,
  type CampaignEvent,
  type CampaignStatsRange,
} from "@/lib/analytics";

type CampaignStatsCardsProps = {
  tenantId: string;
};

export type CampaignStatsHandle = {
  fetchMetrics: () => Promise<void>;
  clearEvents: () => void;
};

function countByName(events: CampaignEvent[], eventName: string): number {
  return events.filter((event) => event.event_name === eventName).length;
}

export const CampaignStatsCards = forwardRef<CampaignStatsHandle, CampaignStatsCardsProps>(
  function CampaignStatsCards({ tenantId }, ref) {
    const copy = tenantConfig.copy.admin.stats;
    const [rawEvents, setRawEvents] = useState<CampaignEvent[]>([]);
    const [activeFilter, setActiveFilter] = useState<CampaignStatsRange>("today");
    const [refreshing, setRefreshing] = useState(false);

    const fetchMetrics = useCallback(async () => {
      setRefreshing(true);
      try {
        const events = await fetchCampaignEvents(tenantId);
        setRawEvents(events);
      } finally {
        setRefreshing(false);
      }
    }, [tenantId]);

    useImperativeHandle(
      ref,
      () => ({
        fetchMetrics,
        clearEvents: () => setRawEvents([]),
      }),
      [fetchMetrics],
    );

    useEffect(() => {
      void fetchMetrics();
    }, [fetchMetrics]);

    const stats = useMemo(() => {
      const events =
        activeFilter === "all"
          ? rawEvents
          : rawEvents.filter(
              (event) =>
                new Date(event.created_at).toDateString() ===
                new Date().toDateString(),
            );
      return {
        quizComplete: countByName(events, "quiz_complete"),
        googleClick: countByName(events, "google_click"),
        rewardRedeemed: countByName(events, "reward_redeemed"),
      };
    }, [activeFilter, rawEvents]);

    const cards = [
      { key: "quiz", label: copy.quiz, value: stats.quizComplete },
      { key: "google", label: copy.google, value: stats.googleClick },
      { key: "redeem", label: copy.redeemed, value: stats.rewardRedeemed },
    ] as const;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {cards.map((card) => (
            <article
              key={card.key}
              className="rounded-2xl bg-surface px-3 py-4 text-center shadow-sm"
            >
              <p className="font-display text-2xl tabular-nums text-ink">{card.value}</p>
              <p className="mt-1 text-[11px] font-medium leading-snug text-muted">
                {card.label}
              </p>
            </article>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 rounded-2xl bg-surface p-1">
            {(["today", "all"] as const).map((id) => {
              const selected = activeFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveFilter(id)}
                  className={`min-h-10 flex-1 rounded-xl text-sm font-medium transition-colors ${
                    selected
                      ? "bg-background text-ink shadow-sm"
                      : "text-muted"
                  }`}
                >
                  {id === "today" ? copy.today : copy.allTime}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void fetchMetrics()}
            disabled={refreshing}
            aria-label={copy.refresh}
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-ink transition-colors hover:bg-background disabled:opacity-70"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </button>
        </div>
      </div>
    );
  },
);
