"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { tenantConfig } from "@/config/tenant.config";

export function MerchantLogin({
  venueSlug,
  initialMessage,
}: {
  venueSlug: string;
  initialMessage?: string;
}) {
  const router = useRouter();
  const copy = tenantConfig.copy.admin;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialMessage ?? "");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/merchant-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, venueSlug }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        reason?: string;
      };

      if (!response.ok || !result.ok) {
        setError(
          result.reason === "venue-membership-required"
            ? "Bu hesap bu mekanın yönetim ekibinde değil."
            : "E-posta veya parola hatalı.",
        );
        return;
      }

      router.refresh();
    } catch {
      setError("Giriş şu anda tamamlanamadı. Lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[var(--bg-canvas)] px-5 py-8 text-[var(--text-headline)]">
      <div className="flex items-start justify-between gap-3">
        <BrandWordmark compact markOnly />
        <Link
          href={`/${venueSlug}`}
          className="max-w-[8.75rem] shrink-0 rounded-full border border-[var(--text-headline)]/20 bg-[var(--card-surface)] px-3 py-1.5 text-right text-[11px] font-semibold leading-snug text-[var(--text-headline)] transition hover:opacity-90"
        >
          {copy.openApp}
        </Link>
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-body)]">
        {copy.kicker}
      </p>
      <h1 className="mt-2 font-display text-[1.85rem] text-[var(--text-headline)]">
        İşletmeci Girişi
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-body)]">
        Mekan yönetimine Supabase hesabınızla giriş yapın.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            E-posta
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            placeholder="ornek@isletme.com"
            className="mt-2 w-full rounded-2xl border border-[var(--text-headline)]/15 bg-[var(--card-surface)] px-4 py-3.5 text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            Parola
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            placeholder="Parolanız"
            className="mt-2 w-full rounded-2xl border border-[var(--text-headline)]/15 bg-[var(--card-surface)] px-4 py-3.5 text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary min-h-14 w-full disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>
    </section>
  );
}
