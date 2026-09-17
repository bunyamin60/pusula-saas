export type ArcadePersistGame = "taboo" | "whoami" | "blockblast";

function sessionKeys(game: ArcadePersistGame, tenantId: string): string[] {
  return [
    `${game}_session_${tenantId}`,
    `${game}_state`,
    `${game}_state_${tenantId}`,
  ];
}

export function clearArcadeGameSession(
  game: ArcadePersistGame,
  tenantId: string,
): void {
  if (typeof window === "undefined") return;
  for (const key of sessionKeys(game, tenantId)) {
    window.localStorage.removeItem(key);
  }
}
