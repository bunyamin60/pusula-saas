"use client";

import { ExperienceBack } from "@/components/ExperienceBack";
import { tenantConfig, type TalkCategory } from "@/config/tenant.config";
import { useCampaign } from "@/lib/useCampaign";

type TalkPickProps = {
  onHome: () => void;
  onChoose: (categoryId: string) => void;
};

export function TalkPick({ onHome, onChoose }: TalkPickProps) {
  const copy = tenantConfig.copy.talk;
  const campaign = useCampaign();
  const categories = campaign.talkCategories;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-x-hidden">
      <ExperienceBack onBack={onHome} />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
        {copy.eyebrow}
      </p>
      <h2 className="mt-2 font-sans text-[1.85rem] font-extrabold leading-tight tracking-tight text-[#272343]">
        {copy.pickTitle}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{copy.pickLead}</p>

      <div className="mt-6 grid gap-3">
        {categories.map((category) => (
          <MoodCard
            key={category.id}
            category={category}
            onChoose={() => onChoose(category.id)}
          />
        ))}
      </div>
    </section>
  );
}

function MoodCard({
  category,
  onChoose,
}: {
  category: TalkCategory;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className="flex min-h-[5.75rem] items-center gap-4 rounded-2xl border border-[#272343]/15 bg-[#e3f6f5] px-4 py-4 text-left shadow-sm transition-transform active:scale-[0.99]"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#bae8e8] text-2xl">
        {category.icon}
      </span>
      <span className="min-w-0">
        <span className="block font-sans text-xl font-extrabold leading-tight tracking-tight text-[#272343]">
          {category.title}
        </span>
        <span className="mt-1 block text-sm leading-snug text-muted">
          {category.caption}
        </span>
      </span>
    </button>
  );
}
