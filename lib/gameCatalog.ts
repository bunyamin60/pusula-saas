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
  path: string;
  /** Full-bleed lobby cover under /public */
  coverImage: string;
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
    path: "/draw",
    coverImage: "/games/images/cizbil.webp",
  },
  {
    id: "trivia",
    filter: "cafe",
    path: "/trivia",
    coverImage: "/games/images/bilgiyarismasi.webp",
  },
  {
    id: "blockblast",
    filter: "cafe",
    path: "/blockblast",
    coverImage: "/games/images/blockblast.webp",
  },
  {
    id: "taboo",
    filter: "together",
    path: "/taboo",
    coverImage: "/games/images/tabu.webp",
  },
  {
    id: "whoami",
    filter: "together",
    path: "/whoami",
    coverImage: "/games/images/benkimim.webp",
  },
  {
    id: "icebreaker",
    filter: "together",
    path: "/icebreaker",
    coverImage: "/games/images/sohbetkartlari.webp",
  },
  {
    id: "wheel",
    filter: "together",
    path: "/wheel",
    coverImage: "/games/images/hesapkimde.webp",
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
