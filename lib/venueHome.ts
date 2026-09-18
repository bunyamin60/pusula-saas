export type VenueHomeView = "welcome" | "lobby";

function storageKey(tenantId: string): string {
  return `venue_home_${tenantId}`;
}

export function readVenueHomeView(tenantId: string): VenueHomeView {
  if (typeof window === "undefined" || !tenantId) return "welcome";
  try {
    return window.sessionStorage.getItem(storageKey(tenantId)) === "lobby"
      ? "lobby"
      : "welcome";
  } catch {
    return "welcome";
  }
}

export function writeVenueHomeView(tenantId: string, view: VenueHomeView): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    window.sessionStorage.setItem(storageKey(tenantId), view);
  } catch {
    // Session persistence is optional on locked browsers.
  }
}

export function clearVenueHomeView(tenantId: string): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    window.sessionStorage.removeItem(storageKey(tenantId));
  } catch {
    // ignore
  }
}
