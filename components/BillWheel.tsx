"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { tenantConfig } from "@/config/tenant.config";

type Person = { id: string; name: string; color: string };

const SLICE_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFD166",
  "#6C5CE7",
  "#FFA07A",
  "#00D2D3",
  "#A8E6CF",
];

function secureRandom() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] / 2 ** 32;
}

function seedPeople(): Person[] {
  return tenantConfig.copy.billWheel.defaultNames.map((name, index) => ({
    id: `seed-${index}`,
    name,
    color: SLICE_COLORS[index % SLICE_COLORS.length],
  }));
}

export function BillWheel() {
  const copy = tenantConfig.copy.billWheel;
  const [people, setPeople] = useState<Person[]>(seedPeople);
  const [draft, setDraft] = useState("");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Person | null>(null);

  const spinningRef = useRef(false);
  const rotationRef = useRef(0);
  const peopleRef = useRef(people);
  const timerRef = useRef<number | null>(null);
  peopleRef.current = people;

  const size = 280;
  const cx = size / 2;
  const arc = people.length ? 360 / people.length : 360;

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!winner) return;
    void confetti({
      particleCount: 140,
      spread: 78,
      startVelocity: 38,
      origin: { y: 0.42 },
      colors: SLICE_COLORS,
    });
  }, [winner]);

  function addName() {
    const name = draft.trim();
    if (!name || people.length >= 8) return;
    if (
      people.some(
        (person) => person.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"),
      )
    ) {
      setDraft("");
      return;
    }
    setPeople((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        name,
        color: SLICE_COLORS[current.length % SLICE_COLORS.length],
      },
    ]);
    setDraft("");
  }

  function removeName(id: string) {
    if (spinningRef.current) return;
    setPeople((current) => current.filter((person) => person.id !== id));
    setWinner(null);
  }

  function spinWheel() {
    const list = peopleRef.current;
    if (spinningRef.current || list.length < 2) return;
    spinningRef.current = true;
    setSpinning(true);
    setWinner(null);

    const slice = 360 / list.length;
    const index = Math.floor(secureRandom() * list.length);
    const extraTurns = 5 + Math.floor(secureRandom() * 2);
    const current = rotationRef.current;
    const currentMod = ((current % 360) + 360) % 360;
    const targetMod = (360 - (index * slice + slice / 2)) % 360;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;
    const next = current + extraTurns * 360 + delta;
    rotationRef.current = next;

    requestAnimationFrame(() => {
      setRotation(next);
    });

    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      spinningRef.current = false;
      setSpinning(false);
      setWinner(list[index]);
    }, tenantConfig.billWheel.spinMs);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addName();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={copy.namePlaceholder}
          maxLength={18}
          className="min-h-12 flex-1 rounded-2xl border-2 border-[var(--text-headline)]/15 bg-white px-4 py-3 text-sm font-bold text-[var(--text-headline)] outline-none focus:border-[var(--btn-primary)]"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-2xl bg-[var(--btn-primary)] px-6 font-extrabold text-[var(--btn-text)] shadow-sm transition hover:brightness-95 active:scale-95"
        >
          {copy.nameAdd}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {people.map((person) => (
          <span
            key={person.id}
            className="flex items-center gap-2 rounded-full border border-[var(--text-headline)]/15 bg-[var(--card-surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-headline)] shadow-xs"
          >
            {person.name}
            <button
              type="button"
              onClick={() => removeName(person.id)}
              className="cursor-pointer font-black leading-none hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {people.length < 2 ? (
        <p className="mt-2 text-xs font-medium text-muted">{copy.nameHint}</p>
      ) : null}

      <div className="relative mx-auto mt-5 size-[18.5rem] shrink-0">
        <ArcadePin />
        <div className="pointer-events-none absolute inset-0 rounded-full border-[6px] border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] shadow-[inset_0_0_24px_rgba(0,0,0,0.06)]">
          <div className="relative size-full overflow-hidden rounded-full">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="size-full will-change-transform"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: `transform ${tenantConfig.billWheel.spinMs}ms cubic-bezier(0.15, 0.85, 0.2, 1)`,
              }}
            >
              {people.map((person, index) => {
                const start = ((index * arc - 90) * Math.PI) / 180;
                const end = (((index + 1) * arc - 90) * Math.PI) / 180;
                const large = arc > 180 ? 1 : 0;
                const x1 = cx + cx * Math.cos(start);
                const y1 = cx + cx * Math.sin(start);
                const x2 = cx + cx * Math.cos(end);
                const y2 = cx + cx * Math.sin(end);
                const lx = cx + cx * 0.62 * Math.cos((start + end) / 2);
                const ly = cx + cx * 0.62 * Math.sin((start + end) / 2);
                return (
                  <g key={person.id}>
                    <path
                      d={`M ${cx} ${cx} L ${x1} ${y1} A ${cx} ${cx} 0 ${large} 1 ${x2} ${y2} Z`}
                      fill={person.color}
                    />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#ffffff"
                      fontSize={people.length > 5 ? 11 : 13}
                      fontWeight={900}
                      className="font-sans font-black"
                      style={{
                        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))",
                      }}
                    >
                      {person.name.slice(0, 8)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        <button
          type="button"
          onClick={spinWheel}
          disabled={spinning || people.length < 2}
          className="absolute top-1/2 left-1/2 z-20 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-4 border-white bg-[var(--btn-primary)] text-sm font-black tracking-wider text-[var(--btn-text)] uppercase shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-80"
        >
          {copy.spin}
        </button>
      </div>

      <AnimatePresence>
        {winner ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-ink/65"
              aria-label={copy.close}
              onClick={() => setWinner(null)}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="relative z-10 w-full max-w-md rounded-3xl border border-ink/15 bg-surface px-5 py-6 text-center shadow-lift"
            >
              <h3 className="mt-1 font-sans text-2xl font-extrabold tracking-tight text-on-surface">
                {copy.resultName.replace("{name}", winner.name)}
              </h3>
              <button type="button" onClick={spinWheel} className="btn-primary mt-5 w-full">
                {copy.resultCta}
              </button>
              <button
                type="button"
                onClick={() => setWinner(null)}
                className="btn-secondary mt-2 w-full"
              >
                {copy.close}
              </button>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function ArcadePin() {
  return (
    <svg
      viewBox="0 0 24 32"
      className="pointer-events-none absolute left-1/2 top-0 z-30 h-8 w-6 -translate-x-1/2 -translate-y-1 text-[var(--text-headline)] drop-shadow-md"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 2.2c-4.3 0-7.8 3.4-7.8 7.7 0 6.4 7.8 20.1 7.8 20.1S19.8 16.3 19.8 9.9C19.8 5.6 16.3 2.2 12 2.2z"
      />
      <circle cx="12" cy="10" r="3.15" fill="#ffffff" />
    </svg>
  );
}
