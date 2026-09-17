import { arcadeGameEnabled } from "@/lib/gameCatalog";
import type { CatalogGameId, EnabledGames } from "@/config/tenant.config";

export function catalogGameEnabled(
  games: EnabledGames,
  id: CatalogGameId,
): boolean {
  if (id === "draw") return arcadeGameEnabled(games, "draw");
  if (id === "quiz") return arcadeGameEnabled(games, "trivia");
  if (id === "taboo") return arcadeGameEnabled(games, "taboo");
  if (id === "whoami") return arcadeGameEnabled(games, "whoami");
  if (id === "blockblast") return arcadeGameEnabled(games, "blockblast");
  if (id === "talk") return arcadeGameEnabled(games, "icebreaker");
  if (id === "bill") return arcadeGameEnabled(games, "wheel");
  return false;
}
