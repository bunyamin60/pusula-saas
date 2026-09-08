"use client";

import { useEffect, useLayoutEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Lock } from "lucide-react";
import {
  tenantConfig,
  type CampaignProduct,
  type CompassOption,
  type LogoShape,
  type TalkPrompt,
  type TenantCategory,
  type ThemePresetId,
  type WheelPrize,
} from "@/config/tenant.config";
import {
  activeWheelPrizes,
  getActiveTenantId,
  isValidAdminPassword,
  isValidBaristaPin,
  isValidDuration,
  matchTagsOf,
  optionDescOf,
  optionTagOf,
  questionTitleOf,
  talkCategoriesValid,
  type CampaignSettings,
} from "@/lib/campaignState";
import {
  DEFAULT_TENANT_ID,
  logoFrameClass,
  logoImageClass,
  parseThemeConfig,
  resolveLogoShape,
  resolveLogoUrl,
  themeConfigFromPreset,
  tokensFromThemeConfig,
} from "@/lib/tenant";
import { resolveTenantCategory } from "@/lib/landingCopy";
import { applyThemeTokens } from "@/lib/themeCss";

type AdminPanel =
  | "menu"
  | "theme"
  | "landing"
  | "campaign"
  | "wheel"
  | "compass"
  | "products"
  | "talk"
  | "social"
  | "security";

type CampaignFormProps = {
  initial: CampaignSettings;
  onSave: (next: CampaignSettings) => Promise<CampaignSettings>;
  onReset: () => Promise<CampaignSettings>;
  onLogout: () => void;
};

export function CampaignForm({
  initial,
  onSave,
  onReset,
  onLogout,
}: CampaignFormProps) {
  const copy = tenantConfig.copy.admin;
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId() ?? DEFAULT_TENANT_ID;
  const [form, setForm] = useState<CampaignSettings>(initial);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState<AdminPanel>("menu");
  const [talkView, setTalkView] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial);
  }, [initial.revision, tenantId]);

  useLayoutEffect(() => {
    applyThemeTokens(tokensFromThemeConfig(form.themeConfig));
  }, [form.themeConfig]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isValidBaristaPin(form.baristaPin)) {
      setError(copy.pinError);
      setPanel("campaign");
      setTalkView(null);
      return;
    }
    if (!isValidAdminPassword(form.adminPassword ?? "")) {
      setError(copy.adminPasswordError);
      setPanel("security");
      setTalkView(null);
      return;
    }
    if (!isValidDuration(form.durationMinutes)) {
      setError(copy.durationError);
      setPanel("campaign");
      setTalkView(null);
      return;
    }
    if (!talkCategoriesValid(form.talkCategories)) {
      setError(copy.talkMinError);
      setPanel("talk");
      setTalkView(null);
      return;
    }

    setSaving(true);
    try {
      const themeConfig = parseThemeConfig(
        form.themeConfig,
        themeConfigFromPreset(
          form.themeConfig?.preset ?? form.themePreset ?? "terracotta",
        ),
      );
      const saved = await onSave({
        ...form,
        hook: form.hook.trim(),
        alternativePerk: form.alternativePerk.trim(),
        ctaText: form.ctaText.trim(),
        googleReviewUrl: form.googleReviewUrl.trim(),
        instagramUrl: form.instagramUrl.trim(),
        landingKicker: form.landingKicker.trim(),
        landingAccent: form.landingAccent.trim(),
        heroTitle: (form.heroTitle ?? form.landingGreeting ?? "").trim(),
        heroSubtitle: (form.heroSubtitle ?? form.landingSubhead ?? "").trim(),
        landingGreeting: (form.heroTitle ?? form.landingGreeting ?? "").trim(),
        landingSubhead: (form.heroSubtitle ?? form.landingSubhead ?? "").trim(),
        brandName: (form.brandName ?? "").trim(),
        logoUrl: (form.logoUrl ?? "").trim(),
        themePreset: themeConfig.preset,
        themeConfig,
        category: resolveTenantCategory(form.category),
        adminPassword: (form.adminPassword ?? "").trim(),
      });
      setForm(saved);
      setMessage(copy.saved);
      window.setTimeout(() => setMessage(""), 2200);
    } catch {
      setError(copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  function changeHook(hook: string) {
    setForm({ ...form, hook });
  }

  const activePrizeCount = activeWheelPrizes(form.wheelPrizes).length;

  function updatePrize(id: string, patch: Partial<WheelPrize>) {
    setForm({
      ...form,
      wheelPrizes: form.wheelPrizes.map((prize) =>
        prize.id === id ? { ...prize, ...patch } : prize,
      ),
    });
  }

  function togglePrize(id: string) {
    const prize = form.wheelPrizes.find((item) => item.id === id);
    if (!prize) return;
    if (prize.active && activePrizeCount <= tenantConfig.wheel.minActive) {
      setError(copy.wheelMinError);
      return;
    }
    setError("");
    updatePrize(id, { active: !prize.active });
  }

  function deletePrize(id: string) {
    const prize = form.wheelPrizes.find((item) => item.id === id);
    if (!prize) return;
    if (prize.active && activePrizeCount <= tenantConfig.wheel.minActive) {
      setError(copy.wheelMinError);
      return;
    }
    setError("");
    setForm({
      ...form,
      wheelPrizes: form.wheelPrizes.filter((item) => item.id !== id),
    });
  }

  function addPrize() {
    const current = form.wheelPrizes ?? [];
    const color =
      tenantConfig.wheel.palette[current.length % tenantConfig.wheel.palette.length];
    const next: WheelPrize = {
      id: `prize-${Date.now()}`,
      icon: "🎁",
      label: copy.wheelEmptyLabel,
      caption: "",
      color,
      active: true,
    };
    setForm({ ...form, wheelPrizes: [...current, next] });
  }

  function updateTalkPrompt(
    categoryId: string,
    promptId: string,
    patch: Partial<TalkPrompt>,
  ) {
    setForm({
      ...form,
      talkCategories: form.talkCategories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              prompts: category.prompts.map((prompt) =>
                prompt.id === promptId ? { ...prompt, text: prompt.text, ...patch } : prompt,
              ),
            }
          : category,
      ),
    });
  }

  function addTalkPrompt(categoryId: string) {
    const next: TalkPrompt = {
      id: `talk-${categoryId}-${Date.now()}`,
      text: copy.talkEmptyPrompt,
      kind: categoryId === "mix-table" ? "redflag" : "write",
    };
    setForm({
      ...form,
      talkCategories: form.talkCategories.map((category) =>
        category.id === categoryId
          ? { ...category, prompts: [...category.prompts, next] }
          : category,
      ),
    });
  }

  function deleteTalkPrompt(categoryId: string, promptId: string) {
    const category = form.talkCategories.find((item) => item.id === categoryId);
    const remaining = (category?.prompts ?? []).filter((prompt) => prompt.id !== promptId);
    if (remaining.filter((prompt) => prompt.text.trim()).length < tenantConfig.talk.minPrompts) {
      setError(copy.talkMinError);
      return;
    }
    setError("");
    setForm({
      ...form,
      talkCategories: form.talkCategories.map((item) =>
        item.id === categoryId ? { ...item, prompts: remaining } : item,
      ),
    });
  }

  function updateQuestionPrompt(index: number, prompt: string) {
    setForm({
      ...form,
      questions: form.questions.map((question, questionIndex) =>
        questionIndex === index
          ? { ...question, prompt, title: prompt }
          : question,
      ),
    });
  }

  function updateOption(
    questionIndex: number,
    optionIndex: number,
    patch: Partial<Pick<CompassOption, "label" | "caption" | "tag">>,
  ) {
    setForm({
      ...form,
      questions: form.questions.map((question, index) => {
        if (index !== questionIndex) return question;
        const options = question.options.map((option, current) => {
          if (current !== optionIndex) return option;
          const next = { ...option, ...patch };
          if (patch.caption !== undefined) next.desc = patch.caption;
          return next;
        });
        return { ...question, options };
      }),
    });
  }

  function updateProduct(id: string, patch: Partial<CampaignProduct>) {
    setForm({
      ...form,
      products: form.products.map((product) =>
        product.id === id ? { ...product, ...patch } : product,
      ),
    });
  }

  function toggleProductTag(id: string, tag: string) {
    const product = form.products.find((item) => item.id === id);
    if (!product) return;
    const current = matchTagsOf(product);
    const tags = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag];
    updateProduct(id, { tags, match_tags: tags });
  }

  function addProduct() {
    const next: CampaignProduct = {
      id: `product-${Date.now()}`,
      name: copy.productEmpty,
      description: "",
      imageUrl: "",
      tags: [],
      match_tags: [],
      tagline: "",
      tastingNotes: [],
      accentColor: "",
    };
    setForm({ ...form, products: [...form.products, next] });
  }

  function deleteProduct(id: string) {
    if (form.products.length <= 1) {
      setError(copy.productMinError);
      return;
    }
    setError("");
    setForm({
      ...form,
      products: form.products.filter((product) => product.id !== id),
    });
  }

  function selectThemePreset(id: ThemePresetId) {
    const previousShape = form.themeConfig?.logo_shape;
    const themeConfig = {
      ...themeConfigFromPreset(id),
      logo_shape: previousShape ?? resolveLogoShape(undefined, tenantId),
    };
    applyThemeTokens(tokensFromThemeConfig(themeConfig));
    setForm({
      ...form,
      themePreset: id,
      themeConfig,
    });
  }

  function selectLogoShape(shape: LogoShape) {
    setForm({
      ...form,
      themeConfig: {
        ...parseThemeConfig(form.themeConfig, themeConfigFromPreset(form.themePreset)),
        logo_shape: shape,
      },
    });
  }

  const resolvedCategory = resolveTenantCategory(form.category);
  const optionTagHint =
    copy.optionTagHint[resolvedCategory] ?? copy.optionTagHint.general;

  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            {copy.kicker}
          </p>
          <h1 className="mt-2 font-display text-[1.85rem] text-ink">{copy.title}</h1>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-xs font-medium text-on-primary"
        >
          <Lock className="size-3.5" />
          {copy.logout}
        </button>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-8">
        {panel === "menu" ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-muted">{copy.menuLead}</p>
            <div className="grid gap-3">
              {(
                [
                  "theme",
                  "landing",
                  "campaign",
                  "compass",
                  "products",
                  "talk",
                  "social",
                  "security",
                ] as const
              ).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPanel(id);
                    setTalkView(null);
                    setError("");
                  }}
                  className="flex min-h-[4.75rem] items-center gap-4 rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background text-2xl">
                    {copy.sectionIcons[id]}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-xl leading-tight text-ink">
                      {copy.sections[id]}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted">
                      {copy.sectionHints[id]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (panel === "talk" && talkView) {
                  setTalkView(null);
                  return;
                }
                setPanel("menu");
                setTalkView(null);
              }}
              className="inline-flex min-h-11 items-center rounded-full px-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              ← {panel === "talk" && talkView ? copy.backToTalk : copy.backToMenu}
            </button>
          </div>
        )}

        {panel === "theme" ? (
        <section className="space-y-5">
          <SectionTitle>{copy.sections.theme}</SectionTitle>

          <Field
            label={copy.fields.brandName.label}
            hint={copy.fields.brandName.hint}
          >
            <input
              value={form.brandName ?? ""}
              onChange={(event) =>
                setForm({ ...form, brandName: event.target.value })
              }
              className="field-input"
            />
          </Field>

          <Field
            label={copy.fields.logoUrl.label}
            hint={copy.fields.logoUrl.hint}
          >
            <input
              value={form.logoUrl ?? ""}
              onChange={(event) =>
                setForm({ ...form, logoUrl: event.target.value })
              }
              className="field-input"
            />
          </Field>

          {(resolveLogoUrl(form.logoUrl, tenantId) ? (
            <div className="flex justify-center rounded-2xl bg-background px-4 py-5">
              <div
                className={logoFrameClass(
                  resolveLogoShape(form.themeConfig?.logo_shape, tenantId),
                )}
              >
                <img
                  src={resolveLogoUrl(form.logoUrl, tenantId)}
                  alt=""
                  className={logoImageClass(
                    resolveLogoShape(form.themeConfig?.logo_shape, tenantId),
                  )}
                />
              </div>
            </div>
          ) : null)}

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              {copy.fields.logoShape.label}
            </legend>
            <p className="text-xs leading-relaxed text-muted">
              {copy.fields.logoShape.hint}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["circle", "square"] as LogoShape[]).map((id) => {
                const selected =
                  resolveLogoShape(form.themeConfig?.logo_shape, tenantId) === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectLogoShape(id)}
                    className={`min-h-12 rounded-2xl border px-3 py-3 text-sm leading-snug ${
                      selected
                        ? "border-primary bg-background text-ink"
                        : "border-transparent bg-surface text-muted"
                    }`}
                  >
                    {copy.fields.logoShape[id]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              {copy.fields.themePreset.label}
            </legend>
            <p className="text-xs leading-relaxed text-muted">
              {copy.fields.themePreset.hint}
            </p>
            <div className="grid gap-3">
              {(Object.keys(tenantConfig.themePresets) as ThemePresetId[]).map(
                (id) => {
                  const preset = tenantConfig.themePresets[id];
                  const selected =
                    (form.themeConfig?.preset ?? form.themePreset) === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectThemePreset(id)}
                      className={`flex min-h-[4.75rem] items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-colors ${
                        selected
                          ? "border-primary bg-background"
                          : "border-transparent bg-surface"
                      }`}
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background text-2xl">
                        {preset.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-xl leading-tight text-ink">
                          {preset.label}
                        </span>
                        <span className="mt-1 block text-sm leading-snug text-muted">
                          {preset.caption}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1" aria-hidden>
                        <span
                          className="size-4 rounded-full border border-ink/10"
                          style={{ background: preset.config.primary }}
                        />
                        <span
                          className="size-4 rounded-full border border-ink/10"
                          style={{ background: preset.config.bg }}
                        />
                        <span
                          className="size-4 rounded-full border border-ink/10"
                          style={{ background: preset.config.accent }}
                        />
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              {copy.fields.category.label}
            </legend>
            <p className="text-xs leading-relaxed text-muted">
              {copy.fields.category.hint}
            </p>
            <div className="grid gap-2">
              {(["cafe", "lounge", "food", "general"] as TenantCategory[]).map(
                (id) => {
                  const selected = resolveTenantCategory(form.category) === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setForm({ ...form, category: id })}
                      className={`flex min-h-12 items-center rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                        selected
                          ? "border-primary bg-background text-ink"
                          : "border-transparent bg-surface"
                      }`}
                    >
                      {copy.fields.category[id]}
                    </button>
                  );
                },
              )}
            </div>
          </fieldset>
        </section>
        ) : null}

        {panel === "landing" ? (
        <section className="space-y-5">
          <SectionTitle>{copy.sections.landing}</SectionTitle>

          <Field
            label={copy.fields.landingBadge.label}
            hint={copy.fields.landingBadge.hint}
          >
            <input
              value={form.landingKicker}
              onChange={(event) =>
                setForm({ ...form, landingKicker: event.target.value })
              }
              className="field-input"
            />
          </Field>

          <SectionTitle>{copy.fields.heroSection}</SectionTitle>

          <Field
            label={copy.fields.heroTitle.label}
            hint={copy.fields.heroTitle.hint}
          >
            <textarea
              value={form.heroTitle ?? form.landingGreeting ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  heroTitle: event.target.value,
                  landingGreeting: event.target.value,
                })
              }
              rows={2}
              className="field-input min-h-[4.5rem] resize-y"
            />
          </Field>

          <Field
            label={copy.fields.heroSubtitle.label}
            hint={copy.fields.heroSubtitle.hint}
          >
            <textarea
              value={form.heroSubtitle ?? form.landingSubhead ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  heroSubtitle: event.target.value,
                  landingSubhead: event.target.value,
                })
              }
              rows={2}
              className="field-input min-h-[4.5rem] resize-y"
            />
          </Field>

          <Field
            label={copy.fields.landingAccent.label}
            hint={copy.fields.landingAccent.hint}
          >
            <input
              value={form.landingAccent}
              onChange={(event) =>
                setForm({ ...form, landingAccent: event.target.value })
              }
              className="field-input"
            />
          </Field>
        </section>
        ) : null}

        {panel === "campaign" ? (
        <section className="space-y-5">
          <SectionTitle>{copy.sections.campaign}</SectionTitle>

          <Field label={copy.fields.hook.label} hint={copy.fields.hook.hint}>
            <textarea
              value={form.hook}
              onChange={(event) => changeHook(event.target.value)}
              rows={3}
              className="field-input min-h-[5.5rem] resize-y"
            />
          </Field>

          <Field label={copy.fields.cta.label} hint={copy.fields.cta.hint}>
            <textarea
              value={form.ctaText}
              onChange={(event) =>
                setForm({ ...form, ctaText: event.target.value })
              }
              rows={3}
              className="field-input min-h-[5.5rem] resize-y"
            />
          </Field>

          <Field
            label={copy.fields.alternative.label}
            hint={copy.fields.alternative.hint}
          >
            <textarea
              value={form.alternativePerk}
              onChange={(event) =>
                setForm({ ...form, alternativePerk: event.target.value })
              }
              rows={2}
              className="field-input min-h-[4.5rem] resize-y"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={copy.fields.duration.label}
              hint={copy.fields.duration.hint}
            >
              <input
                type="number"
                min={1}
                max={120}
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm({
                    ...form,
                    durationMinutes: Number(event.target.value),
                  })
                }
                className="field-input"
              />
            </Field>

            <Field label={copy.fields.pin.label} hint={copy.fields.pin.hint}>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={form.baristaPin}
                onChange={(event) =>
                  setForm({
                    ...form,
                    baristaPin: event.target.value.replace(/\D/g, "").slice(0, 4),
                  })
                }
                className="field-input tracking-[0.4em]"
              />
            </Field>
          </div>

          <div className="rounded-2xl bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  {copy.fields.active.label}
                </p>
                <p className="mt-1 text-sm text-ink">
                  {form.active ? copy.fields.active.on : copy.fields.active.off}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.active}
                onClick={() => setForm({ ...form, active: !form.active })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none ${
                  form.active ? "bg-primary" : "bg-ink/20"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                    form.active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
        ) : null}

        {panel === "wheel" ? (
        <section className="space-y-5">
          <SectionTitle>{copy.sections.wheel}</SectionTitle>

          {(form.wheelPrizes ?? []).map((prize) => (
            <article
              key={prize.id}
              className="space-y-3 rounded-2xl border border-ink/10 bg-background px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={prize.active}
                  onClick={() => togglePrize(prize.id)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none ${
                    prize.active ? "bg-primary" : "bg-ink/20"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                      prize.active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => deletePrize(prize.id)}
                  className="text-xs text-muted underline decoration-primary/30 underline-offset-4"
                >
                  {copy.wheelDelete}
                </button>
              </div>

              <Field
                label={copy.fields.wheelIcon.label}
                hint={copy.fields.wheelIcon.hint}
              >
                <input
                  value={prize.icon}
                  onChange={(event) =>
                    updatePrize(prize.id, { icon: event.target.value })
                  }
                  maxLength={4}
                  className="field-input max-w-[5.5rem] text-center text-lg"
                />
              </Field>
              <Field
                label={copy.fields.wheelLabel.label}
                hint={copy.fields.wheelLabel.hint}
              >
                <input
                  value={prize.label}
                  onChange={(event) =>
                    updatePrize(prize.id, { label: event.target.value })
                  }
                  className="field-input"
                />
              </Field>
              <Field label={copy.fields.wheelCaption.label} hint="">
                <textarea
                  value={prize.caption}
                  onChange={(event) =>
                    updatePrize(prize.id, { caption: event.target.value })
                  }
                  rows={2}
                  className="field-input min-h-[4rem] resize-y"
                />
              </Field>
              <Field label={copy.fields.wheelColor.label} hint="">
                <div className="flex flex-wrap gap-2">
                  {tenantConfig.wheel.palette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updatePrize(prize.id, { color })}
                      className={`size-8 rounded-full border-2 ${
                        prize.color === color
                          ? "border-ink"
                          : "border-transparent"
                      }`}
                      style={{ background: color }}
                      aria-label={color}
                    />
                  ))}
                </div>
              </Field>
            </article>
          ))}

          <button type="button" onClick={addPrize} className="btn-secondary w-full">
            {copy.wheelAdd}
          </button>
        </section>
        ) : null}

        {panel === "compass" ? (
        <section className="space-y-5">
          <SectionTitle>{copy.sections.compass}</SectionTitle>

          {form.questions.map((question, questionIndex) => (
            <article
              key={question.id}
              className="space-y-4 rounded-2xl border border-ink/10 bg-background px-4 py-5"
            >
              <Field
                label={copy.questionTitle.replace(
                  "{n}",
                  String(questionIndex + 1),
                )}
                hint=""
              >
                <input
                  value={questionTitleOf(question)}
                  onChange={(event) =>
                    updateQuestionPrompt(questionIndex, event.target.value)
                  }
                  className="field-input"
                />
              </Field>

              {question.options.map((option, optionIndex) => (
                <div
                  key={option.id}
                  className="space-y-3 rounded-2xl bg-background px-3 py-4"
                >
                  <Field
                    label={copy.optionTitle.replace(
                      "{n}",
                      String(optionIndex + 1),
                    )}
                    hint=""
                  >
                    <input
                      value={option.label}
                      onChange={(event) =>
                        updateOption(questionIndex, optionIndex, {
                          label: event.target.value,
                        })
                      }
                      className="field-input"
                    />
                  </Field>
                  <Field
                    label={copy.optionCaption.replace(
                      "{n}",
                      String(optionIndex + 1),
                    )}
                    hint=""
                  >
                    <textarea
                      value={optionDescOf(option)}
                      onChange={(event) =>
                        updateOption(questionIndex, optionIndex, {
                          caption: event.target.value,
                        })
                      }
                      rows={2}
                      className="field-input min-h-[4rem] resize-y"
                    />
                  </Field>
                  <Field label={copy.optionTag} hint={optionTagHint}>
                    <input
                      value={option.tag ?? option.id}
                      onChange={(event) =>
                        updateOption(questionIndex, optionIndex, {
                          tag: event.target.value,
                        })
                      }
                      className="field-input"
                    />
                  </Field>
                </div>
              ))}
            </article>
          ))}
        </section>
        ) : null}

        {panel === "products" ? (
        <section className="space-y-5">
          <SectionTitle>{copy.sections.products}</SectionTitle>
          <p className="text-sm leading-relaxed text-muted">{copy.productTagsHint}</p>

          {(form.products ?? []).map((product) => (
            <article
              key={product.id}
              className="space-y-4 rounded-2xl border border-ink/10 bg-background px-4 py-5"
            >
              <Field label={copy.productName} hint="">
                <input
                  value={product.name}
                  onChange={(event) =>
                    updateProduct(product.id, { name: event.target.value })
                  }
                  className="field-input"
                />
              </Field>
              <Field label={copy.productDescription} hint="">
                <textarea
                  value={product.description}
                  onChange={(event) =>
                    updateProduct(product.id, { description: event.target.value })
                  }
                  rows={2}
                  className="field-input min-h-[4.5rem] resize-y"
                />
              </Field>
              <Field label={copy.productTagline} hint={copy.productTaglineHint}>
                <input
                  value={product.tagline ?? ""}
                  onChange={(event) =>
                    updateProduct(product.id, { tagline: event.target.value })
                  }
                  className="field-input"
                />
              </Field>
              <Field label={copy.productNotes} hint={copy.productNotesHint}>
                <textarea
                  value={(product.tastingNotes ?? []).join("\n")}
                  onChange={(event) =>
                    updateProduct(product.id, {
                      tastingNotes: event.target.value.split(/\r?\n/),
                    })
                  }
                  rows={3}
                  className="field-input min-h-[5rem] resize-y"
                />
              </Field>
              <Field label={copy.productAccent} hint={copy.productAccentHint}>
                <input
                  value={product.accentColor ?? ""}
                  onChange={(event) =>
                    updateProduct(product.id, { accentColor: event.target.value })
                  }
                  placeholder="#00D2FF"
                  className="field-input"
                />
              </Field>
              <Field label={copy.productImage} hint={copy.productImageHint}>
                <input
                  value={product.imageUrl}
                  onChange={(event) =>
                    updateProduct(product.id, { imageUrl: event.target.value })
                  }
                  placeholder="/products/flat-white.png"
                  className="field-input"
                />
              </Field>
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt=""
                  className="h-24 w-24 rounded-2xl object-cover"
                />
              ) : null}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  {copy.productTags}
                </p>
                {(form.questions ?? []).map((question) => (
                  <div key={question.id} className="space-y-2">
                    <p className="text-sm leading-snug text-muted">
                      {questionTitleOf(question)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {question.options.map((option) => {
                        const tag = optionTagOf(option);
                        if (!tag) return null;
                        const on = matchTagsOf(product).includes(tag);
                        return (
                          <button
                            key={`${question.id}-${option.id || tag}`}
                            type="button"
                            onClick={() => toggleProductTag(product.id, tag)}
                            className={`rounded-full px-3 py-2 text-sm leading-snug transition-colors ${
                              on
                                ? "bg-primary text-on-primary shadow-lift"
                                : "bg-black/45 text-white"
                            }`}
                          >
                            {option.label.trim() || tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => deleteProduct(product.id)}
                className="text-xs text-muted underline decoration-primary/30 underline-offset-4"
              >
                {copy.productDelete}
              </button>
            </article>
          ))}

          <button type="button" onClick={addProduct} className="btn-secondary w-full">
            {copy.productAdd}
          </button>
        </section>
        ) : null}

        {panel === "talk" ? (
        <section className="space-y-5">
          <SectionTitle>{copy.sections.talk}</SectionTitle>

          {!talkView ? (
            <div className="grid gap-3">
              {(form.talkCategories ?? []).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setTalkView(category.id)}
                  className="flex min-h-[4.75rem] items-center gap-4 rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background text-2xl">
                    {category.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-xl leading-tight text-ink">
                      {category.title}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted">
                      {category.caption}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {(form.talkCategories ?? [])
            .filter((category) => category.id === talkView)
            .map((category) => (
            <article
              key={category.id}
              className="space-y-3 rounded-2xl border border-ink/10 bg-surface px-4 py-4"
            >
              <div>
                <p className="font-display text-lg text-ink">
                  {category.icon} {category.title}
                </p>
                <p className="mt-1 text-sm text-muted">{category.caption}</p>
              </div>

              {category.prompts.map((prompt, promptIndex) => (
                <div key={prompt.id} className="rounded-2xl bg-background px-3 py-3">
                  <Field
                    label={`${copy.talkPromptLabel} ${promptIndex + 1}`}
                    hint=""
                  >
                    <textarea
                      value={prompt.text}
                      onChange={(event) =>
                        updateTalkPrompt(category.id, prompt.id, {
                          text: event.target.value,
                        })
                      }
                      rows={3}
                      className="field-input min-h-[5rem] resize-y"
                    />
                  </Field>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateTalkPrompt(category.id, prompt.id, { kind: "write" })
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        prompt.kind === "write"
                          ? "bg-primary text-on-primary"
                          : "bg-background text-muted"
                      }`}
                    >
                      {copy.talkKindWrite}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateTalkPrompt(category.id, prompt.id, { kind: "redflag" })
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        prompt.kind === "redflag"
                          ? "bg-primary text-on-primary"
                          : "bg-background text-muted"
                      }`}
                    >
                      {copy.talkKindFlag}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTalkPrompt(category.id, prompt.id)}
                    className="mt-2 text-xs text-muted underline decoration-primary/30 underline-offset-4"
                  >
                    {copy.talkDelete}
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addTalkPrompt(category.id)}
                className="text-sm font-medium text-primary"
              >
                {copy.talkAdd}
              </button>
            </article>
          ))}
        </section>
        ) : null}

        {panel === "social" ? (
        <section className="space-y-5">
          <SectionTitle>{copy.sections.social}</SectionTitle>

          <Field label={copy.fields.google.label} hint={copy.fields.google.hint}>
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder={copy.fields.google.placeholder}
              value={form.googleReviewUrl}
              onChange={(event) =>
                setForm({ ...form, googleReviewUrl: event.target.value })
              }
              className="field-input"
            />
          </Field>

          <Field
            label={copy.fields.instagram.label}
            hint={copy.fields.instagram.hint}
          >
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder={copy.fields.instagram.placeholder}
              value={form.instagramUrl}
              onChange={(event) =>
                setForm({ ...form, instagramUrl: event.target.value })
              }
              className="field-input"
            />
          </Field>
        </section>
        ) : null}

        {panel === "security" ? (
        <section className="space-y-5">
          <SectionTitle>{copy.sections.security}</SectionTitle>

          <Field
            label={copy.fields.adminPassword.label}
            hint={copy.fields.adminPassword.hint}
          >
            <input
              type="password"
              autoComplete="new-password"
              placeholder={copy.passwordPlaceholder}
              value={form.adminPassword ?? ""}
              onChange={(event) =>
                setForm({ ...form, adminPassword: event.target.value })
              }
              className="field-input tracking-[0.12em]"
            />
          </Field>
        </section>
        ) : null}

        {error && <p className="text-sm text-red-700">{error}</p>}
        {message && <p className="text-sm text-perfect">{message}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? copy.saving : copy.save}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            void (async () => {
              setSaving(true);
              setError("");
              try {
                setForm(await onReset());
                setPanel("menu");
                setTalkView(null);
                setMessage(copy.saved);
                window.setTimeout(() => setMessage(""), 2200);
              } catch {
                setError(copy.saveError);
              } finally {
                setSaving(false);
              }
            })();
          }}
          className="btn-secondary w-full"
        >
          {copy.reset}
        </button>
      </form>

      <Link
        href={`/${tenantId}`}
        className="mt-8 text-center text-sm text-muted underline decoration-primary/30 underline-offset-4"
      >
        {copy.openApp}
      </Link>
    </section>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-xl text-ink">{children}</h2>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <span className="mt-2 block">{children}</span>
      {hint ? (
        <span className="mt-1.5 block text-xs leading-relaxed text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
