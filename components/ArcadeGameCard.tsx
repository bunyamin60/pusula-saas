"use client";

import Image from "next/image";
import { useState } from "react";
import { User, Users } from "lucide-react";
import type { ArcadeGame } from "@/lib/gameCatalog";
import { tenantConfig } from "@/config/tenant.config";

type ArcadeGameCardProps = {
  game: ArcadeGame;
  title: string;
  badge: string;
  caption: string;
  onClick: () => void;
};

const SOLO_GAME_IDS = new Set(["trivia", "blockblast"]);

export function ArcadeGameCard({
  game,
  title,
  badge,
  caption,
  onClick,
}: ArcadeGameCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const enterCta = tenantConfig.copy.landing.showcase.enterCta;
  const solo = SOLO_GAME_IDS.has(game.id);
  const BadgeIcon = solo ? User : Users;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title}. ${enterCta}`}
      className="relative flex aspect-[4/5] w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] text-left shadow-sm transition-transform duration-150 active:scale-[0.96]"
    >
      {!imageFailed ? (
        <Image
          src={game.coverImage}
          alt=""
          fill
          sizes="(max-width: 448px) 50vw, 220px"
          className="z-0 object-cover object-center"
          onError={() => setImageFailed(true)}
          priority={game.id === "blockblast"}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 z-0 bg-[var(--card-surface)]"
        />
      )}

      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/95 via-black/45 to-black/10"
      />

      <span className="absolute right-2.5 top-2.5 z-20 inline-flex max-w-[calc(100%-1.25rem)] items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 font-sans text-[10px] font-bold text-white backdrop-blur-md">
        <BadgeIcon className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{badge}</span>
      </span>

      <span className="relative z-20 mt-auto flex w-full min-w-0 flex-col gap-2 p-3 pt-10">
        <span className="min-w-0">
          <span className="block truncate font-sans text-base font-black leading-tight tracking-tight text-white">
            {title}
          </span>
          <span className="mt-0.5 block truncate font-sans text-[11px] font-medium leading-snug text-white/80">
            {caption}
          </span>
        </span>

        <span className="flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[var(--btn-primary)] px-3 font-sans text-xs font-extrabold text-[var(--btn-text)]">
          {enterCta}
        </span>
      </span>
    </button>
  );
}
