import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  Dices,
  MessageCircleHeart,
  Palette,
  Trophy,
  Zap,
} from "lucide-react";
import { tenantConfig, type EnabledGames } from "@/config/tenant.config";

export type ArcadeFilter = "all" | "cafe" | "duel" | "together";
export type ArcadeGameId =
  | "draw"
  | "trivia"
  | "pop_trivia"
  | "reflex"
  | "icebreaker"
  | "wheel";

export type ArcadeGame = {
  id: ArcadeGameId;
  filter: Exclude<ArcadeFilter, "all">;
  gradient: string;
  image: string;
  icon: LucideIcon;
  path: string;
};

export type ArcadeLobbyKind = "duel" | "table" | "party";

const ENABLED_BY_CATALOG: Record<ArcadeGameId, keyof EnabledGames> = {
  draw: "draw",
  trivia: "quiz",
  pop_trivia: "trivia",
  reflex: "swipe",
  icebreaker: "talk",
  wheel: "bill",
};

export const GAME_CATALOG: readonly ArcadeGame[] = [
  {
    id: "draw",
    filter: "cafe",
    gradient: "from-rose-500 to-red-600",
    image: "/games/draw.png",
    icon: Palette,
    path: "/draw",
  },
  {
    id: "trivia",
    filter: "cafe",
    gradient: "from-blue-700 to-indigo-900",
    image: "/games/trivia.png",
    icon: Trophy,
    path: "/trivia",
  },
  {
    id: "pop_trivia",
    filter: "duel",
    gradient: "from-rose-600 to-red-900",
    image: "/games/clapper.png",
    icon: Clapperboard,
    path: "/duel?mode=pop_trivia",
  },
  {
    id: "reflex",
    filter: "duel",
    gradient: "from-cyan-600 to-blue-900",
    image: "/games/reflex.png",
    icon: Zap,
    path: "/duel?mode=reflex",
  },
  {
    id: "icebreaker",
    filter: "together",
    gradient: "from-violet-600 to-purple-800",
    image: "/games/icebreaker.png",
    icon: MessageCircleHeart,
    path: "/icebreaker",
  },
  {
    id: "wheel",
    filter: "together",
    gradient: "from-orange-500 to-amber-600",
    image: "/games/wheel.png",
    icon: Dices,
    path: "/wheel",
  },
];

export function arcadeGameEnabled(
  games: EnabledGames,
  id: ArcadeGameId,
): boolean {
  return games[ENABLED_BY_CATALOG[id]] !== false;
}

export function arcadeGameCopy(id: ArcadeGameId): {
  title: string;
  badge: string;
} {
  const showcase = tenantConfig.copy.landing.showcase;
  if (id === "draw") return { title: showcase.drawTitle, badge: showcase.drawBadge };
  if (id === "trivia") return { title: showcase.quizTitle, badge: showcase.quizBadge };
  if (id === "pop_trivia") {
    return { title: showcase.triviaTitle, badge: showcase.triviaBadge };
  }
  if (id === "reflex") {
    return { title: showcase.swipeTitle, badge: showcase.swipeBadge };
  }
  if (id === "icebreaker") {
    return { title: showcase.talkTitle, badge: showcase.talkBadge };
  }
  return { title: showcase.billTitle, badge: showcase.billBadge };
}

export function visibleArcadeGames(
  games: EnabledGames,
  filter: ArcadeFilter,
): ArcadeGame[] {
  return GAME_CATALOG.filter(
    (game) =>
      arcadeGameEnabled(games, game.id) &&
      (filter === "all" || game.filter === filter),
  );
}

export function arcadeLobbyKind(id: ArcadeGameId): ArcadeLobbyKind {
  if (id === "pop_trivia" || id === "reflex") return "duel";
  if (id === "draw" || id === "trivia") return "table";
  return "party";
}

const FEATURED_ARCADE_IDS: readonly ArcadeGameId[] = [
  "draw",
  "trivia",
  "icebreaker",
  "wheel",
];

export function featuredArcadeGames(games: EnabledGames): ArcadeGame[] {
  return GAME_CATALOG.filter(
    (game) =>
      FEATURED_ARCADE_IDS.includes(game.id) && arcadeGameEnabled(games, game.id),
  );
}

export function arcadeDuelMode(
  id: ArcadeGameId,
): "trivia" | "swipe" | null {
  if (id === "pop_trivia") return "trivia";
  if (id === "reflex") return "swipe";
  return null;
}
