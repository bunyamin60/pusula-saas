"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import {
  getCampaignSettings,
  getServerCampaign,
  subscribeToCampaign,
  type CampaignSettings,
} from "@/lib/campaignState";

export const SeededCampaignContext = createContext<CampaignSettings | null>(null);

export function useCampaign() {
  const seeded = useContext(SeededCampaignContext);
  return useSyncExternalStore(
    subscribeToCampaign,
    getCampaignSettings,
    () => seeded ?? getServerCampaign(),
  );
}
