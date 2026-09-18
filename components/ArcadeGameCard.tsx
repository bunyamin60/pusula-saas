"use client";

import Image from "next/image";
import { useState } from "react";
import type { ArcadeGame } from "@/lib/gameCatalog";
import { tenantConfig } from "@/config/tenant.config";

type ArcadeGameCardProps = {
  game: ArcadeGame;
  title: string;
  badge: string;
  caption: string;
  onClick: () => void;
};

export function ArcadeGameCard({
  game,
  title,
  badge,
  caption,
  onClick,
}: ArcadeGameCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const enterCta = tenantConfig.copy.landing.showcase.enterCta;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title}. ${enterCta}`}
      className="relative flex aspect-[4/5] min-h-[220px] w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] text-left shadow-sm transition-transform duration-150 active:scale-[0.96]"
    >
      {!imageFailed ? (
        <Image
          src={game.coverImage}
          alt=""
          fill
          sizes="(max-width: 448px) 50vw, 220px"
          className="z-0 object-cover"
          onError={() => setImageFailed(true)}
          priority={game.id === "blockblast"}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 z-0 bg-[var(--card-surface)]"
        />
      )}

      {/* Cover scrim: keeps type readable on any photo (not brand chrome). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
      />

      <span className="relative z-20 flex h-full flex-col justify-between p-4">
        <span className="inline-flex max-w-full self-start rounded-full bg-black/30 px-3 py-1 font-sans text-[11px] font-bold text-white backdrop-blur-md">
          {badge}
        </span>

        <span className="flex items-end justify-between gap-3">
          <span className="min-w-0 flex-1">
            <span className="block font-sans text-xl font-black tracking-tight text-white">
              {title}
            </span>
            <span className="mt-1 block font-sans text-xs font-medium leading-snug text-white/80 line-clamp-2">
              {caption}
            </span>
          </span>

          <span className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-full bg-[var(--btn-primary)] px-4 py-2 font-sans text-xs font-bold text-[var(--btn-text)] transition-transform active:scale-95 active:brightness-95">
            {enterCta}
          </span>
        </span>
      </span>
    </button>
  );
}
