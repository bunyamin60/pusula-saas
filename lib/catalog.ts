import { arcadeGameEnabled } from "@/lib/gameCatalog";
import type { CatalogGameId, EnabledGames } from "@/config/tenant.config";

export function catalogGameEnabled(
  games: EnabledGames,
  id: CatalogGameId,
): boolean {
  if (id === "draw") return arcadeGameEnabled(games, "draw");
  if (id === "quiz") return arcadeGameEnabled(games, "trivia");
  if (id === "trivia") return arcadeGameEnabled(games, "pop_trivia");
  if (id === "swipe") return arcadeGameEnabled(games, "reflex");
  if (id === "talk") return arcadeGameEnabled(games, "icebreaker");
  if (id === "bill") return arcadeGameEnabled(games, "wheel");
  return games[id] !== false;
}
