import { getSupabase } from "@/lib/supabase";

export type CampaignEventName =
  | "quiz_complete"
  | "google_click"
  | "reward_redeemed";

export type CampaignStatsRange = "today" | "all";

export type CampaignEvent = {
  event_name: string;
  created_at: string;
  product_name?: string | null;
};

const PUSULA_COUNTED_KEY = "pusula_counted";
let pusulaCountedMemory = false;

export function resetPusulaCountedFlag(): void {
  pusulaCountedMemory = false;
  try {
    sessionStorage.removeItem(PUSULA_COUNTED_KEY);
  } catch {
    // Ignore storage errors during test reset.
  }
}

export function logQuizCompleteOnce(
  tenantId: string,
  productName?: string,
): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(PUSULA_COUNTED_KEY)) return;
      sessionStorage.setItem(PUSULA_COUNTED_KEY, "true");
    } else if (pusulaCountedMemory) {
      return;
    } else {
      pusulaCountedMemory = true;
    }
  } catch {
    if (pusulaCountedMemory) return;
    pusulaCountedMemory = true;
  }
  void logCampaignEvent(tenantId, "quiz_complete", productName);
}

export async function logCampaignEvent(
  tenantId: string,
  eventName: CampaignEventName | string,
  productName?: string,
): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return;
    const row: Record<string, string> = {
      tenant_id: tenantId,
      event_name: eventName,
    };
    if (productName) row.product_name = productName;
    await supabase.from("campaign_events").insert([row]);
  } catch {
    // Guest flow must never break if analytics is offline.
  }
}

export async function fetchCampaignEvents(
  tenantId: string,
): Promise<CampaignEvent[]> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return [];
    const { data, error } = await supabase
      .from("campaign_events")
      .select("event_name, created_at, product_name")
      .eq("tenant_id", tenantId);
    if (error || !data) return [];
    return data as CampaignEvent[];
  } catch {
    return [];
  }
}

export async function deleteCampaignEvents(tenantId: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return false;
    const { error } = await supabase
      .from("campaign_events")
      .delete()
      .eq("tenant_id", tenantId);
    return !error;
  } catch {
    return false;
  }
}
