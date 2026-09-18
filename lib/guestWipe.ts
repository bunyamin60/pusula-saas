import { resetPusulaCountedFlag } from "@/lib/analytics";
import { clearArcadeGameSession } from "@/lib/arcadeSession";
import { clearCustomerProfile } from "@/lib/customerProfile";
import { clearGossipLocalState } from "@/lib/dailyQuestion";
import { clearLoyalty } from "@/lib/loyalty";
import { clearPlayRewardProgress } from "@/lib/playReward";
import { resetSession } from "@/lib/session";
import { clearStampCard } from "@/lib/stampCard";
import { clearVenueHomeView } from "@/lib/venueHome";

export function wipeGuestLocalData(tenantId: string): void {
  clearLoyalty(tenantId);
  resetPusulaCountedFlag();
  clearPlayRewardProgress();
  resetSession();
  clearCustomerProfile();
  clearGossipLocalState();
  clearStampCard(tenantId);
  clearVenueHomeView(tenantId);
  clearArcadeGameSession("taboo", tenantId);
  clearArcadeGameSession("whoami", tenantId);
  clearArcadeGameSession("blockblast", tenantId);
}
