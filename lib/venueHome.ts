export type VenueHomeView = "welcome" | "lobby";
export type LobbyTab = "games" | "events" | "surveys";

function storageKey(tenantId: string): string {
  return `venue_home_${tenantId}`;
}

function lobbyTabKey(tenantId: string): string {
  return `venue_lobby_tab_${tenantId}`;
}

export function readLobbyTab(tenantId: string): LobbyTab {
  if (typeof window === "undefined" || !tenantId) return "games";
  try {
    const value = window.sessionStorage.getItem(lobbyTabKey(tenantId));
    if (value === "events" || value === "surveys" || value === "games") {
      return value;
    }
  } catch {
    // ignore
  }
  return "games";
}

export function writeLobbyTab(tenantId: string, tab: LobbyTab): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    window.sessionStorage.setItem(lobbyTabKey(tenantId), tab);
  } catch {
    // ignore
  }
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
