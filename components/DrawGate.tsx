"use client";

import { useState } from "react";
import { tenantConfig } from "@/config/tenant.config";
import {
  cafeDrawRoomId,
  makeDrawPin,
  parseDrawPin,
  privateDrawRoomId,
} from "@/lib/drawGame";

type DrawGateProps = {
  tenantId: string;
  onJoin: (roomId: string) => void;
};

export function DrawGate({ tenantId, onJoin }: DrawGateProps) {
  const copy = tenantConfig.copy.duel.draw;
  const [pin, setPin] = useState("");
  const [invalid, setInvalid] = useState(false);

  function joinPrivate() {
    const parsed = parseDrawPin(pin);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    onJoin(privateDrawRoomId(tenantId, parsed));
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col justify-center gap-3">
      <button
        type="button"
        onClick={() => onJoin(cafeDrawRoomId(tenantId))}
        className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] px-4 py-5 text-left shadow-sm transition active:scale-[0.98]"
      >
        <p className="font-sans text-xl font-extrabold tracking-tight text-[var(--text-headline)]">
          {copy.cafeRoom}
        </p>
        <p className="mt-1 font-sans text-sm font-medium leading-snug text-[var(--text-body)]">
          {copy.cafeRoomHint}
        </p>
      </button>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] px-4 py-5 shadow-sm">
        <p className="font-sans text-xl font-extrabold tracking-tight text-[var(--text-headline)]">
          {copy.privateRoom}
        </p>
        <p className="mt-1 font-sans text-sm font-medium leading-snug text-[var(--text-body)]">
          {copy.privateRoomHint}
        </p>
        <button
          type="button"
          onClick={() => onJoin(privateDrawRoomId(tenantId, makeDrawPin()))}
          className="btn-primary mt-4 w-full"
        >
          {copy.createPin}
        </button>
        <p className="mt-2 font-sans text-xs font-medium text-[var(--text-body)]">
          {copy.createPinHint}
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            joinPrivate();
          }}
        >
          <input
            value={pin}
            onChange={(event) => {
              setInvalid(false);
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={copy.pinPlaceholder}
            className="field-input min-h-11 flex-1 text-center font-sans font-extrabold tracking-[0.28em]"
          />
          <button type="submit" className="btn-primary min-h-11 shrink-0 px-4">
            {copy.joinPin}
          </button>
        </form>
        <p className="mt-2 font-sans text-xs font-medium text-[var(--text-body)]">
          {invalid ? copy.pinInvalid : copy.joinPinHint}
        </p>
      </div>
    </section>
  );
}
