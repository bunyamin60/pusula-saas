"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { BrandWordmark } from "@/components/BrandWordmark";
import { tenantConfig, type CatalogGameId, type EnabledGames, type GuestPaletteId } from "@/config/tenant.config";
import { catalogGameEnabled } from "@/lib/catalog";
import {
  clampRewardDuration,
  getActiveTenantId,
  isValidAdminPassword,
  saveCampaign,
} from "@/lib/campaignState";
import {
  fetchCouponMetrics,
  formatRedeemedClock,
  listTodayRedeemedCoupons,
  redeemRewardCoupon,
  type CouponMetrics,
  type RedeemCouponResult,
  type RewardCoupon,
} from "@/lib/rewardCoupons";
import {
  fetchActiveQuestion,
  fetchDailyAnswers,
  hideDailyAnswer,
  publishDailyQuestion,
  subscribeDailyFeed,
  type DailyAnswer,
  type DailyQuestion,
} from "@/lib/dailyQuestion";
import { adminPasswordAccepted } from "@/lib/adminAuth";
import {
  DEFAULT_TENANT_ID,
  isGuestPaletteId,
  resolveGuestPaletteId,
  themeConfigFromPreset,
  tokensFromThemeConfig,
  writeActiveThemeId,
} from "@/lib/tenant";
import { applyThemeTokens } from "@/lib/themeCss";
import { useCampaign } from "@/lib/useCampaign";

type DeskTab = "kasa" | "venue" | "gossip" | "metrics";

const DESK_GAMES: CatalogGameId[] = [
  "draw",
  "quiz",
  "taboo",
  "whoami",
  "blockblast",
  "talk",
  "bill",
];

export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const desk = tenantConfig.copy.desk;
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId() ?? DEFAULT_TENANT_ID;
  const [tab, setTab] = useState<DeskTab>("kasa");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[var(--bg-canvas)] text-[var(--text-headline)]">
      <header className="sticky top-0 z-20 border-b border-[var(--text-headline)]/10 bg-[var(--bg-canvas)]/95 px-5 pb-3 pt-5 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <BrandWordmark compact markOnly />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight text-[var(--text-headline)]">{desk.title}</p>
            <p className="truncate text-[11px] text-[var(--text-body)]">
              {campaign.brandName || tenantConfig.brand.name}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link
              href={`/${tenantId}`}
              className="max-w-[8.75rem] rounded-full border border-[var(--text-headline)]/20 bg-[var(--card-surface)] px-3 py-1.5 text-right text-[11px] font-semibold leading-snug text-[var(--text-headline)] transition hover:opacity-90"
            >
              {desk.guestView}
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="text-[11px] font-semibold text-[var(--text-body)] transition hover:text-[var(--text-headline)]"
            >
              {desk.logout}
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] p-1.5">
          {(
            [
              ["kasa", desk.tabs.kasa],
              ["venue", desk.tabs.venue],
              ["gossip", desk.tabs.gossip],
              ["metrics", desk.tabs.metrics],
            ] as const
          ).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`w-full rounded-xl px-2 py-2 text-[11px] leading-tight transition-all ${
                  active
                    ? "bg-[var(--btn-primary)] font-extrabold text-[var(--btn-text)] shadow-sm"
                    : "font-semibold text-[var(--text-body)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 px-5 py-5">
        {tab === "kasa" ? <KasaTab tenantId={tenantId} /> : null}
        {tab === "venue" ? <VenueTab /> : null}
        {tab === "gossip" ? <GossipTab tenantId={tenantId} /> : null}
        {tab === "metrics" ? <MetricsTab tenantId={tenantId} /> : null}
      </div>
    </main>
  );
}

function KasaTab({ tenantId }: { tenantId: string }) {
  const copy = tenantConfig.copy.kasa;
  const desk = tenantConfig.copy.desk.kasa;
  const campaign = useCampaign();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedeemCouponResult | null>(null);
  const [history, setHistory] = useState<RewardCoupon[]>([]);

  const refreshHistory = useCallback(async () => {
    setHistory(await listTodayRedeemedCoupons(tenantId));
  }, [tenantId]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  async function redeem(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const next = await redeemRewardCoupon(tenantId, code);
    setResult(next);
    if (next.ok) await refreshHistory();
    setBusy(false);
  }

  const usedMessage =
    result && !result.ok && result.reason === "used"
      ? formatRedeemedClock(result.redeemedAt)
        ? copy.usedAt.replace("{time}", formatRedeemedClock(result.redeemedAt))
        : copy.used
      : null;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-[var(--text-body)]">{desk.lead}</p>
      <form onSubmit={(event) => void redeem(event)} className="space-y-4">
        {result?.ok ? (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-8 text-center">
            <p className="text-4xl" aria-hidden>
              ✓
            </p>
            <p className="mt-3 font-display text-xl text-emerald-700">
              {copy.success.replace(
                "{table}",
                result.coupon.tableId || tenantConfig.brand.tableName || campaign.hook,
              )}
            </p>
          </div>
        ) : null}
        {result && !result.ok ? (
          <div className="rounded-3xl border border-red-400/30 bg-red-400/10 px-5 py-6 text-center">
            <p className="font-display text-lg text-red-600">
              {usedMessage
                ? usedMessage
                : result.reason === "missing"
                  ? copy.missing
                  : copy.offline}
            </p>
          </div>
        ) : null}

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {copy.codeLabel}
          </span>
          <input
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setResult(null);
            }}
            placeholder={copy.codePlaceholder}
            autoCapitalize="characters"
            inputMode="text"
            className="mt-2 w-full rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--card-surface)] px-4 py-5 font-display text-[1.35rem] tracking-[0.12em] text-[var(--text-headline)] outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
          />
        </label>
        <button
          type="submit"
          className="btn-primary w-full min-h-14"
          disabled={busy || !code.trim()}
        >
          {copy.submit}
        </button>
        {result ? (
          <button
            type="button"
            onClick={() => {
              setCode("");
              setResult(null);
            }}
            className="w-full text-center text-sm text-[var(--text-body)]"
          >
            {copy.another}
          </button>
        ) : null}
      </form>

      <section className="rounded-3xl border border-[var(--text-headline)]/10 bg-[var(--card-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
          {desk.history}
        </p>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-body)]">{desk.historyEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((item) => (
              <li
                key={`${item.code}-${item.redeemedAt ?? ""}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-display text-sm tracking-wide text-[var(--text-headline)]">{item.code}</p>
                  <p className="truncate text-[11px] text-[var(--text-body)]">
                    {desk.historyTable.replace(
                      "{table}",
                      item.tableId || tenantConfig.brand.tableName,
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-[var(--text-body)]">
                  {formatRedeemedClock(item.redeemedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function VenueTab() {
  const desk = tenantConfig.copy.desk.venue;
  const admin = tenantConfig.copy.admin;
  const campaign = useCampaign();
  const [brandName, setBrandName] = useState(campaign.brandName);
  const [logoUrl, setLogoUrl] = useState(campaign.logoUrl);
  const [logoFailed, setLogoFailed] = useState(false);
  const [paletteId, setPaletteId] = useState<GuestPaletteId>(
    resolveGuestPaletteId(campaign.themeConfig),
  );
  const [hook, setHook] = useState(campaign.hook);
  const [minutes, setMinutes] = useState(
    clampRewardDuration(campaign.durationMinutes || 20),
  );
  const [games, setGames] = useState<EnabledGames>(campaign.enabledGames);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const hide = window.setTimeout(() => setSaved(false), 2800);
    return () => window.clearTimeout(hide);
  }, [saved]);

  useEffect(() => {
    setBrandName(campaign.brandName);
    setLogoUrl(campaign.logoUrl);
    setLogoFailed(false);
    setPaletteId(resolveGuestPaletteId(campaign.themeConfig));
    setHook(campaign.hook);
    setMinutes(clampRewardDuration(campaign.durationMinutes || 20));
    setGames(campaign.enabledGames);
  }, [
    campaign.brandName,
    campaign.logoUrl,
    campaign.themeConfig,
    campaign.hook,
    campaign.durationMinutes,
    campaign.enabledGames,
  ]);

  async function persist(nextPalette: GuestPaletteId = paletteId) {
    setSaving(true);
    setError(false);
    setSaved(false);
    const durationMinutes = clampRewardDuration(minutes);
    const rewardTitle = hook.trim() || campaign.hook;
    try {
      await saveCampaign({
        ...campaign,
        brandName: brandName.trim() || campaign.brandName,
        logoUrl: logoUrl.trim(),
        themePreset: nextPalette,
        themeConfig: themeConfigFromPreset(nextPalette),
        hook: rewardTitle,
        durationMinutes,
        enabledGames: games,
      });
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await persist();
  }

  async function applyPalette(id: GuestPaletteId) {
    if (!isGuestPaletteId(id)) return;
    const nextTheme = themeConfigFromPreset(id);
    writeActiveThemeId(id);
    applyThemeTokens(tokensFromThemeConfig(nextTheme));
    setPaletteId(id);
    await persist(id);
  }

  const previewSrc = logoUrl.trim();
  const previewLetter = (brandName.trim() || campaign.brandName || "?").slice(0, 1).toUpperCase();

  return (
    <div className="space-y-5">
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <section className="rounded-3xl border border-[var(--text-headline)]/10 bg-[var(--card-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
          {desk.identityTitle}
        </p>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {desk.brandLabel}
          </span>
          <input
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            placeholder={desk.brandPlaceholder}
            className="mt-2 w-full rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-4 py-3.5 text-sm text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {desk.logoLabel}
          </span>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)]">
              {previewSrc && !logoFailed ? (
                <img
                  src={previewSrc}
                  alt=""
                  className="size-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="font-display text-sm text-[var(--text-body)]">{previewLetter}</span>
              )}
            </span>
            <input
              value={logoUrl}
              onChange={(event) => {
                setLogoUrl(event.target.value);
                setLogoFailed(false);
              }}
              placeholder={desk.logoPlaceholder}
              className="min-w-0 flex-1 rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-4 py-3.5 text-sm text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
            />
          </div>
        </label>
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {desk.paletteLabel}
          </legend>
          <p className="mt-1 text-xs text-[var(--text-body)]">{desk.paletteHint}</p>
          <div className="mt-3 grid gap-2">
            {desk.palettes.map((item) => {
              const preset = isGuestPaletteId(item.id)
                ? tenantConfig.themePresets[item.id]
                : tenantConfig.themePresets["sun-mint"];
              const on = paletteId === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border-2 bg-[var(--bg-canvas)] p-3 ${
                    on
                      ? "border-[var(--text-headline)] ring-2 ring-[var(--text-headline)] ring-offset-2 ring-offset-[var(--card-surface)]"
                      : "border-[var(--text-headline)]/10"
                  }`}
                >
                  <span className="flex h-10 overflow-hidden rounded-xl border border-[var(--card-border)]">
                    <span
                      className="flex-1"
                      style={{ backgroundColor: preset.tokens.background }}
                    />
                    <span
                      className="flex-1"
                      style={{ backgroundColor: preset.tokens.primary }}
                    />
                    <span
                      className="flex-1"
                      style={{ backgroundColor: preset.tokens.surface }}
                    />
                  </span>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--text-headline)]">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[var(--text-body)]">
                        {item.caption}
                      </span>
                    </span>
                    {on ? (
                      <span className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-white">
                        {desk.activeBadge}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          if (isGuestPaletteId(item.id)) void applyPalette(item.id);
                        }}
                        className="shrink-0 rounded-xl bg-[var(--btn-primary)] px-3 py-1.5 text-[11px] font-bold text-[var(--btn-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {desk.applyCta}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="rounded-3xl border border-[var(--text-headline)]/10 bg-[var(--card-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
          {desk.perkTitle}
        </p>
        <label className="mt-4 block">
          <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {desk.durationLabel}
            <span className="normal-case tracking-normal text-[var(--text-headline)]">
              {desk.durationValue.replace("{minutes}", String(minutes))}
            </span>
          </span>
          <input
            type="range"
            min={10}
            max={45}
            step={1}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            className="mt-4 w-full accent-sky-400"
          />
          <span className="mt-2 block text-xs text-[var(--text-body)]">{desk.durationHint}</span>
        </label>
        <label className="mt-5 block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {desk.hookLabel}
          </span>
          <textarea
            value={hook}
            onChange={(event) => setHook(event.target.value)}
            placeholder={desk.hookPlaceholder}
            rows={3}
            className="mt-2 w-full resize-y rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-4 py-3.5 text-sm text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
          />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={games.pusulaFunnel !== false}
          onClick={() =>
            setGames((current) => ({
              ...current,
              pusulaFunnel: current.pusulaFunnel === false,
            }))
          }
          className="mt-5 flex w-full items-start justify-between gap-3 rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-4 py-4 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[var(--text-headline)]">{desk.funnelLabel}</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--text-body)]">
              {desk.funnelHint}
            </span>
          </span>
          <IosToggle on={games.pusulaFunnel !== false} className="mt-0.5" />
        </button>
      </section>

      <section className="rounded-3xl border border-[var(--text-headline)]/10 bg-[var(--card-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
          {desk.gamesLabel}
        </p>
        <p className="mt-1 text-xs text-[var(--text-body)]">{desk.gamesHint}</p>
        <div className="mt-3 space-y-2">
          {DESK_GAMES.map((id) => {
            const on = catalogGameEnabled(games, id);
            return (
              <button
                key={id}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() =>
                  setGames((current) => ({ ...current, [id]: !on }))
                }
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-4 py-3 text-left"
              >
                <span className="min-w-0 pr-2">
                  <span className="block text-sm font-bold text-[var(--text-headline)]">
                    {desk.gameLabels[id]}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {desk.gameCaptions[id]}
                  </span>
                </span>
                <IosToggle on={on} />
              </button>
            );
          })}
        </div>
      </section>

      {saved ? (
        <div
          role="status"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-[min(22rem,calc(100%-2.5rem))] -translate-x-1/2 rounded-2xl border border-emerald-400/30 bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
        >
          {admin.saved}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{admin.saveError}</p> : null}

      <button type="submit" className="btn-primary w-full min-h-14" disabled={saving}>
        {saving ? admin.saving : admin.save}
      </button>
    </form>
      <AdminPasswordBox />
    </div>
  );
}

function IosToggle({ on, className = "" }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-[var(--btn-primary)]" : "bg-slate-200"
      } ${className}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </span>
  );
}

function AdminPasswordBox() {
  const desk = tenantConfig.copy.desk.venue;
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId() ?? DEFAULT_TENANT_ID;
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<"mismatch" | "need" | "save" | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const hide = window.setTimeout(() => setSaved(false), 2800);
    return () => window.clearTimeout(hide);
  }, [saved]);

  async function savePassword() {
    setError(null);
    setSaved(false);
    if (
      !adminPasswordAccepted(currentPin, {
        tenantId,
        adminPassword: campaign.adminPassword,
        baristaPin: campaign.baristaPin,
      })
    ) {
      setError("mismatch");
      return;
    }
    if (!newPin.trim() || !isValidAdminPassword(newPin) || newPin.trim().length < 4) {
      setError("need");
      return;
    }
    setSaving(true);
    try {
      await saveCampaign({
        ...campaign,
        adminPassword: newPin.trim(),
      });
      setCurrentPin("");
      setNewPin("");
      setSaved(true);
    } catch {
      setError("save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--text-headline)]/10 bg-[var(--card-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
        {desk.passwordTitle}
      </p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {desk.passwordCurrent}
          </span>
          <input
            type="password"
            value={currentPin}
            onChange={(event) => {
              setCurrentPin(event.target.value);
              setError(null);
            }}
            autoComplete="current-password"
            className="mt-2 w-full rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-4 py-3.5 text-sm text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {desk.passwordNew}
          </span>
          <input
            type="password"
            value={newPin}
            onChange={(event) => {
              setNewPin(event.target.value);
              setError(null);
            }}
            autoComplete="new-password"
            className="mt-2 w-full rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-4 py-3.5 text-sm text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
          />
        </label>
        {error === "mismatch" ? (
          <p className="text-sm text-red-600">{desk.passwordMismatch}</p>
        ) : null}
        {error === "need" ? (
          <p className="text-sm text-red-600">{desk.passwordNeed}</p>
        ) : null}
        {error === "save" ? (
          <p className="text-sm text-red-600">{tenantConfig.copy.admin.saveError}</p>
        ) : null}
        {saved ? (
          <p className="text-sm text-emerald-700">{desk.passwordSaved}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void savePassword()}
          disabled={saving}
          className="btn-primary w-full min-h-12"
        >
          {saving ? tenantConfig.copy.admin.saving : desk.passwordSave}
        </button>
      </div>
    </section>
  );
}

function GossipTab({ tenantId }: { tenantId: string }) {
  const copy = tenantConfig.copy.desk.gossip;
  const [prompt, setPrompt] = useState("");
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [answers, setAnswers] = useState<DailyAnswer[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<"published" | "publishError" | "offline" | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  async function refresh() {
    const nextQuestion = await fetchActiveQuestion(tenantId);
    setQuestion(nextQuestion);
    const nextAnswers = await fetchDailyAnswers(tenantId, {
      questionId: nextQuestion?.id,
      includeHidden: false,
      limit: 20,
    });
    setAnswers(nextAnswers);
  }

  useEffect(() => {
    void refresh();
    return subscribeDailyFeed(tenantId, {
      onQuestion: (next) => {
        if (next.isActive) {
          setQuestion(next);
          void fetchDailyAnswers(tenantId, { includeHidden: false, limit: 20 }).then(
            setAnswers,
          );
        }
      },
      onAnswer: (answer) => {
        if (answer.isHidden) return;
        setAnswers((list) => {
          if (list.some((item) => item.id === answer.id)) return list;
          return [answer, ...list].slice(0, 20);
        });
      },
      onAnswerUpdate: (answer) => {
        setAnswers((list) => {
          if (answer.isHidden) return list.filter((item) => item.id !== answer.id);
          return list.map((item) => (item.id === answer.id ? answer : item));
        });
      },
    });
  }, [tenantId]);

  async function publish() {
    setPublishing(true);
    setNotice(null);
    setErrorDetail(null);
    const result = await publishDailyQuestion(tenantId, prompt);
    setPublishing(false);
    if (!result.ok) {
      console.error("Yayınlama hatası:", result.error);
      setNotice("publishError");
      setErrorDetail(result.error);
      return;
    }
    setPrompt("");
    await refresh();
    setNotice("published");
  }

  async function hide(id: string) {
    setHidingId(id);
    const ok = await hideDailyAnswer(id);
    setHidingId(null);
    if (!ok) {
      setNotice("offline");
      return;
    }
    setAnswers((list) => list.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[var(--text-headline)]/10 bg-[var(--card-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
          {copy.title}
        </p>
        <p className="mt-1 text-xs text-[var(--text-body)]">{copy.lead}</p>
        {question ? (
          <p className="mt-3 font-sans text-sm font-black leading-snug text-[var(--text-headline)]">
            {question.prompt}
          </p>
        ) : null}
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {copy.promptLabel}
          </span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 180))}
            placeholder={copy.promptPlaceholder}
            rows={3}
            className="mt-2 w-full resize-y rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-4 py-3.5 font-sans text-sm text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
          />
        </label>
        <button
          type="button"
          disabled={publishing || prompt.trim().length < 4}
          onClick={() => void publish()}
          className="btn-primary mt-3 w-full min-h-12"
        >
          {publishing ? copy.publishing : copy.publish}
        </button>
        {notice === "published" ? (
          <p className="mt-2 rounded-2xl bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-600">
            {copy.published}
          </p>
        ) : null}
        {notice === "publishError" || notice === "offline" ? (
          <p className="mt-2 text-sm text-red-600">
            {notice === "offline" ? copy.offline : copy.publishError}
            {errorDetail ? (
              <span className="mt-1 block text-xs font-medium leading-relaxed">{errorDetail}</span>
            ) : null}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[var(--text-headline)]/10 bg-[var(--card-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
          {copy.moderationTitle}
        </p>
        {answers.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-body)]">{copy.moderationEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {answers.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[10px] font-extrabold uppercase tracking-wide text-[var(--text-body)]">
                    {item.authorLabel}
                  </p>
                  <p className="mt-1 font-sans text-sm font-medium leading-snug text-[var(--text-headline)]">
                    {item.body}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={hidingId === item.id}
                  onClick={() => void hide(item.id)}
                  className="shrink-0 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 font-sans text-[11px] font-bold text-red-600 transition hover:bg-red-500/20 disabled:opacity-40"
                >
                  {hidingId === item.id ? copy.hidden : copy.hide}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricsTab({ tenantId }: { tenantId: string }) {
  const copy = tenantConfig.copy.desk.metrics;
  const campaign = useCampaign();
  const [metrics, setMetrics] = useState<CouponMetrics | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchCouponMetrics(tenantId).then((next) => {
      if (alive) setMetrics(next);
    });
    return () => {
      alive = false;
    };
  }, [tenantId]);

  const dwell = metrics?.avgDwellMinutes ?? clampRewardDuration(campaign.durationMinutes);
  const cards = [
    {
      key: "dwell",
      label: copy.dwell,
      value: copy.dwellValue.replace("{minutes}", String(dwell)),
    },
    {
      key: "issued",
      label: copy.issued,
      value: String(metrics?.issuedCount ?? "—"),
    },
    {
      key: "redeemed",
      label: copy.redeemed,
      value: String(metrics?.redeemedCount ?? "—"),
    },
  ];

  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <article
          key={card.key}
          className="rounded-3xl border border-[var(--text-headline)]/10 bg-[var(--card-surface)] px-5 py-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {card.label}
          </p>
          <p className="mt-3 font-display text-3xl text-[var(--text-headline)]">{card.value}</p>
        </article>
      ))}
      {metrics && metrics.issuedCount === 0 ? (
        <p className="px-1 text-sm text-[var(--text-body)]">{copy.empty}</p>
      ) : null}
    </div>
  );
}
