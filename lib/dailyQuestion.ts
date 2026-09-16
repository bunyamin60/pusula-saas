import type { RealtimeChannel } from "@supabase/supabase-js";
import { filterProfanity } from "@/lib/profanityFilter";
import { getSupabase, wakeRealtime } from "@/lib/supabase";

export const LAST_GOSSIP_TIME_KEY = "last_gossip_time";
export const LIKED_GOSSIPS_KEY = "liked_gossips";
export const GOSSIP_COOLDOWN_MS = 120_000;
export const GOSSIP_MAX_CHARS = 120;

export type DailyQuestion = {
  id: string;
  tenantId: string;
  prompt: string;
  isActive: boolean;
  createdAt: string;
};

export type DailyAnswer = {
  id: string;
  tenantId: string;
  questionId: string;
  authorLabel: string;
  body: string;
  likeCount: number;
  isHidden: boolean;
  createdAt: string;
};

type QuestionRow = {
  id: string;
  tenant_id: string;
  prompt: string;
  is_active: boolean;
  created_at: string;
};

type AnswerRow = {
  id: string;
  tenant_id: string;
  question_id: string;
  author_label: string;
  body: string;
  like_count: number;
  is_hidden: boolean;
  created_at: string;
};

function questionFromRow(row: QuestionRow): DailyQuestion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    prompt: row.prompt,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function answerFromRow(row: AnswerRow): DailyAnswer {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    questionId: row.question_id,
    authorLabel: row.author_label,
    body: row.body,
    likeCount: Number(row.like_count) || 0,
    isHidden: Boolean(row.is_hidden),
    createdAt: row.created_at,
  };
}

function readNumber(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function gossipCooldownRemaining(): number {
  const last = readNumber(LAST_GOSSIP_TIME_KEY);
  if (last == null) return 0;
  return Math.max(0, GOSSIP_COOLDOWN_MS - (Date.now() - last));
}

export function markGossipSent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_GOSSIP_TIME_KEY, String(Date.now()));
  } catch {
    // Private mode may block storage.
  }
}

export function readLikedGossipIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LIKED_GOSSIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function rememberLikedGossip(id: string): string[] {
  const next = Array.from(new Set([...readLikedGossipIds(), id]));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LIKED_GOSSIPS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearGossipLocalState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_GOSSIP_TIME_KEY);
    window.localStorage.removeItem(LIKED_GOSSIPS_KEY);
  } catch {
    // ignore
  }
}

export async function fetchActiveQuestion(
  tenantId: string,
): Promise<DailyQuestion | null> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return null;
    const { data, error } = await supabase
      .from("daily_questions")
      .select("id, tenant_id, prompt, is_active, created_at")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return questionFromRow(data as QuestionRow);
  } catch {
    return null;
  }
}

export async function fetchDailyAnswers(
  tenantId: string,
  options?: { questionId?: string; includeHidden?: boolean; limit?: number },
): Promise<DailyAnswer[]> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return [];
    const limit = options?.limit ?? 40;
    let query = supabase
      .from("daily_answers")
      .select(
        "id, tenant_id, question_id, author_label, body, like_count, is_hidden, created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (options?.questionId) query = query.eq("question_id", options.questionId);
    if (!options?.includeHidden) query = query.eq("is_hidden", false);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];
    return (data as AnswerRow[])
      .map(answerFromRow)
      .filter((entry) => options?.includeHidden || !entry.isHidden);
  } catch {
    return [];
  }
}

export async function publishDailyQuestion(
  tenantId: string,
  prompt: string,
): Promise<DailyQuestion | null> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return null;
    const { data, error } = await supabase.rpc("publish_daily_question", {
      p_tenant_id: tenantId,
      p_prompt: prompt.trim(),
    });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return questionFromRow(data[0] as QuestionRow);
  } catch {
    return null;
  }
}

export async function submitDailyAnswer(input: {
  tenantId: string;
  questionId: string;
  authorLabel: string;
  body: string;
}): Promise<
  | { ok: true; answer: DailyAnswer }
  | { ok: false; reason: "blocked" | "wait" | "offline" }
> {
  if (gossipCooldownRemaining() > 0) return { ok: false, reason: "wait" };
  const filtered = filterProfanity(input.body);
  if (!filtered.cleanText) return { ok: false, reason: "blocked" };
  try {
    const supabase = getSupabase();
    if (!supabase || !input.tenantId) return { ok: false, reason: "offline" };
    const { data, error } = await supabase
      .from("daily_answers")
      .insert({
        tenant_id: input.tenantId,
        question_id: input.questionId,
        author_label: input.authorLabel.trim().slice(0, 64),
        body: filtered.cleanText,
        is_hidden: false,
        like_count: 0,
      })
      .select(
        "id, tenant_id, question_id, author_label, body, like_count, is_hidden, created_at",
      )
      .single();
    if (error || !data) return { ok: false, reason: "offline" };
    markGossipSent();
    return { ok: true, answer: answerFromRow(data as AnswerRow) };
  } catch {
    return { ok: false, reason: "offline" };
  }
}

export async function hideDailyAnswer(id: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase
      .from("daily_answers")
      .update({ is_hidden: true })
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function likeDailyAnswer(
  answerId: string,
  clientId: string,
): Promise<number | null> {
  const liked = readLikedGossipIds();
  if (liked.includes(answerId)) return null;
  rememberLikedGossip(answerId);
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("like_daily_answer", {
      p_answer_id: answerId,
      p_client_id: clientId,
    });
    if (error) return null;
    const count = Number(data);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

export function subscribeDailyFeed(
  tenantId: string,
  handlers: {
    onQuestion?: (question: DailyQuestion) => void;
    onAnswer?: (answer: DailyAnswer) => void;
    onAnswerUpdate?: (answer: DailyAnswer) => void;
  },
): () => void {
  const supabase = getSupabase();
  if (!supabase || !tenantId) return () => undefined;
  wakeRealtime();
  const channel: RealtimeChannel = supabase
    .channel(`daily_feed_${tenantId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "daily_questions",
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        const row = (payload.new ?? null) as QuestionRow | null;
        if (!row?.id) return;
        handlers.onQuestion?.(questionFromRow(row));
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "daily_answers",
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        const row = payload.new as AnswerRow | undefined;
        if (!row?.id) return;
        handlers.onAnswer?.(answerFromRow(row));
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "daily_answers",
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        const row = payload.new as AnswerRow | undefined;
        if (!row?.id) return;
        handlers.onAnswerUpdate?.(answerFromRow(row));
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
