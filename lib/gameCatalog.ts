import type { LucideIcon } from "lucide-react";
import {
  Dices,
  HelpCircle,
  LayoutGrid,
  MessageCircleHeart,
  Palette,
  Speech,
  Trophy,
} from "lucide-react";
import { tenantConfig, type EnabledGames } from "@/config/tenant.config";

export type ArcadeFilter = "all" | "cafe" | "duel" | "together";
export type ArcadeGameId =
  | "draw"
  | "trivia"
  | "blockblast"
  | "taboo"
  | "whoami"
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
  blockblast: "blockblast",
  taboo: "taboo",
  whoami: "whoami",
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
    id: "blockblast",
    filter: "cafe",
    gradient: "from-fuchsia-500 to-orange-500",
    image: "/games/numbers.png",
    icon: LayoutGrid,
    path: "/blockblast",
  },
  {
    id: "taboo",
    filter: "together",
    gradient: "from-amber-400 to-yellow-600",
    image: "/games/clapper.png",
    icon: Speech,
    path: "/taboo",
  },
  {
    id: "whoami",
    filter: "together",
    gradient: "from-sky-500 to-cyan-700",
    image: "/games/guess.png",
    icon: HelpCircle,
    path: "/whoami",
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
  caption: string;
} {
  const showcase = tenantConfig.copy.landing.showcase;
  if (id === "draw") {
    return {
      title: showcase.drawTitle,
      badge: showcase.drawBadge,
      caption: showcase.drawCaption,
    };
  }
  if (id === "trivia") {
    return {
      title: showcase.quizTitle,
      badge: showcase.quizBadge,
      caption: showcase.quizCaption,
    };
  }
  if (id === "blockblast") {
    return {
      title: showcase.blockblastTitle,
      badge: showcase.blockblastBadge,
      caption: showcase.blockblastCaption,
    };
  }
  if (id === "taboo") {
    return {
      title: showcase.tabooTitle,
      badge: showcase.tabooBadge,
      caption: showcase.tabooCaption,
    };
  }
  if (id === "whoami") {
    return {
      title: showcase.whoamiTitle,
      badge: showcase.whoamiBadge,
      caption: showcase.whoamiCaption,
    };
  }
  if (id === "icebreaker") {
    return {
      title: showcase.talkTitle,
      badge: showcase.talkBadge,
      caption: showcase.talkCaption,
    };
  }
  return {
    title: showcase.billTitle,
    badge: showcase.billBadge,
    caption: showcase.billCaption,
  };
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
  if (id === "draw" || id === "trivia" || id === "taboo") return "table";
  return "party";
}

const FEATURED_ARCADE_IDS: readonly ArcadeGameId[] = [
  "draw",
  "trivia",
  "blockblast",
  "taboo",
  "whoami",
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
  void id;
  return null;
}
