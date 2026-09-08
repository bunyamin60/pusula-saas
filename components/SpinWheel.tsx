"use client";

import { useMemo, useState } from "react";
import { ExperienceBack } from "@/components/ExperienceBack";
import { tenantConfig, type WheelPrize } from "@/config/tenant.config";
import { activeWheelPrizes } from "@/lib/campaignState";
import { useCampaign } from "@/lib/useCampaign";

type SpinWheelProps = {
  onWin: (prize: WheelPrize) => void;
  onBack?: () => void;
};

const PIN = "#E8D5B5";
const PIN_EDGE = "#C4A484";
const HUB = "#F2EAE1";
const TERRACOTTA = "#D85A38";

export function SpinWheel({ onWin, onBack }: SpinWheelProps) {
  const copy = tenantConfig.copy.wheel;
  const campaign = useCampaign();
  const prizes = useMemo(
    () => activeWheelPrizes(campaign.wheelPrizes),
    [campaign.wheelPrizes],
  );
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelPrize | null>(null);

  const size = 280;
  const cx = size / 2;
  const rim = cx - 6;
  const arc = prizes.length ? 360 / prizes.length : 360;

  function spin() {
    if (spinning || prizes.length < tenantConfig.wheel.minActive) return;

    const index = Math.floor(secureRandom() * prizes.length);
    const prize = prizes[index];
    const extraTurns = 5 + Math.floor(secureRandom() * 2);
    const target = extraTurns * 360 - (index * arc + arc / 2);

    setWinner(null);
    setSpinning(true);
    setRotation(target);

    window.setTimeout(() => {
      setWinner(prize);
      window.setTimeout(() => onWin(prize), tenantConfig.wheel.celebrateMs);
    }, tenantConfig.wheel.spinMs);
  }

  return (
    <section className="flex flex-1 flex-col">
      {onBack ? (
        <ExperienceBack onBack={onBack} label={copy.backToTalk} />
      ) : null}
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
        {copy.eyebrow}
      </p>
      <h2 className="mt-2 font-display text-[1.85rem] leading-tight text-ink">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{copy.lead}</p>

      <div className="relative mx-auto mt-7 size-[18.75rem]">
        <div
          className="pointer-events-none absolute inset-[0.15rem] rounded-full border-[4px] border-[#EAE3D9] shadow-[0_8px_24px_rgb(60_36_21_/_0.12)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-[0.42rem] rounded-full border border-[#C4A484]/40"
          aria-hidden
        />

        <div className="absolute inset-[0.55rem] overflow-hidden rounded-full">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="size-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? `transform ${tenantConfig.wheel.spinMs}ms cubic-bezier(0.12, 0.72, 0.12, 1)`
                : "none",
            }}
          >
            {prizes.map((prize, index) => {
              const start = index * arc;
              const end = start + arc;
              const mid = start + arc / 2;
              const world = normalizeAngle(mid + rotation);
              const flipped = world > 90 && world < 270;
              const label = polar(cx, cx, rim * 0.58, mid);
              const pin = polar(cx, cx, rim - 2, start);

              return (
                <g key={prize.id}>
                  <path
                    d={slicePath(cx, cx, rim + 2, start, end)}
                    fill={prize.color}
                  />
                  <g
                    transform={`translate(${label.x} ${label.y}) rotate(${mid + (flipped ? 180 : 0)})`}
                  >
                    {prize.icon ? (
                      <text
                        y={flipped ? 10 : -9}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-[13px] sm:text-sm"
                      >
                        {prize.icon}
                      </text>
                    ) : null}
                    <text
                      y={prize.icon ? (flipped ? -7 : 9) : 0}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={readableInk(prize.color)}
                      className="text-[11px] font-bold tracking-tight sm:text-xs"
                    >
                      {prize.label}
                    </text>
                  </g>
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r="3.2"
                    fill={PIN}
                    stroke={PIN_EDGE}
                    strokeWidth="0.7"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <svg
          viewBox="0 0 24 34"
          className="pointer-events-none absolute left-1/2 top-[-0.2rem] z-30 h-[2.15rem] w-[1.45rem] -translate-x-1/2 drop-shadow-md"
          aria-hidden
        >
          <path
            d="M12 32C12 32 3.4 18.2 3.4 11.2C3.4 6.2 7.1 2.4 12 2.4C16.9 2.4 20.6 6.2 20.6 11.2C20.6 18.2 12 32 12 32Z"
            fill={TERRACOTTA}
          />
          <circle cx="12" cy="11" r="3.15" fill={HUB} />
        </svg>

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-[15] size-[4.85rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/10 shadow-inner"
          style={{ backgroundColor: HUB }}
          aria-hidden
        />

        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className="absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold tracking-[0.14em] text-on-primary shadow-xl transition-transform active:scale-95 disabled:opacity-90"
          style={{ backgroundColor: TERRACOTTA }}
        >
          {spinning ? copy.spinning : copy.spin}
        </button>

        {winner ? <div className="wheel-confetti" aria-hidden /> : null}
      </div>

      {winner ? (
        <article className="mt-5 rounded-2xl border border-ink/8 bg-[#F2EAE1] px-5 py-4 text-center shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {copy.won}
          </p>
          <p className="mt-2 font-display text-[1.35rem] leading-tight text-ink">
            {winner.icon ? <span className="mr-1.5">{winner.icon}</span> : null}
            {winner.label}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {winner.caption}
          </p>
        </article>
      ) : null}
    </section>
  );
}

function slicePath(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
): string {
  const from = polar(cx, cy, r, start);
  const to = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${r} ${r} 0 ${large} 1 ${to.x} ${to.y} Z`;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function readableInk(hex: string): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => part + part)
          .join("")
      : raw;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 148 ? "#1A1716" : "#FFF8F4";
}

function secureRandom(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] / 4294967296;
}
