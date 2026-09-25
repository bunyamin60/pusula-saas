import type { RealtimeChannel } from "@supabase/supabase-js";
import { moderateGossipText } from "@/lib/profanityFilter";
import { getSupabase, wakeRealtime } from "@/lib/supabase";

export const LAST_GOSSIP_TIME_KEY = "last_gossip_time";
export const LAST_GOSSIP_ANSWER_KEY = "last_gossip_answer_id";
export const LIKED_GOSSIPS_KEY = "liked_gossips";
export const GOSSIP_COOLDOWN_MS = 120_000;
export const GOSSIP_MAX_CHARS = 120;

let memoryGossipSentAt: number | null = null;
let memoryLastAnswerId: string | null = null;

export type DailyQuestion = {
  id: string;
  tenantId: string;
  prompt: string;
  isActive: boolean;
  createdAt: string;
};

export type DailyAnswerStatus = "approved" | "pending";

export type DailyAnswer = {
  id: string;
  tenantId: string;
  questionId: string;
  authorLabel: string;
  body: string;
  likeCount: number;
  isHidden: boolean;
  createdAt: string;
  avatarUrl?: string | null;
  status: DailyAnswerStatus;
};

type QuestionRow = {
  id: string;
  tenant_id: string;
  prompt?: string | null;
  question?: string | null;
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
  avatar_url?: string | null;
  status?: string | null;
};

const ANSWER_COLUMNS =
  "id, tenant_id, question_id, author_label, body, like_count, is_hidden, created_at, avatar_url, status";
const ANSWER_COLUMNS_NO_STATUS =
  "id, tenant_id, question_id, author_label, body, like_count, is_hidden, created_at, avatar_url";
const ANSWER_COLUMNS_LEGACY =
  "id, tenant_id, question_id, author_label, body, like_count, is_hidden, created_at";

function questionFromRow(row: QuestionRow): DailyQuestion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    prompt: (row.prompt || row.question || "").trim(),
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function parseStatus(value: string | null | undefined): DailyAnswerStatus {
  return value === "pending" ? "pending" : "approved";
}

function answerFromRow(row: AnswerRow): DailyAnswer {
  const avatar =
    typeof row.avatar_url === "string" ? row.avatar_url.trim() : "";
  return {
    id: row.id,
    tenantId: row.tenant_id,
    questionId: row.question_id,
    authorLabel: row.author_label,
    body: row.body,
    likeCount: Number(row.like_count) || 0,
    isHidden: Boolean(row.is_hidden),
    createdAt: row.created_at,
    avatarUrl: avatar || null,
    status: parseStatus(row.status),
  };
}

function asAnswerRow(value: unknown): AnswerRow | null {
  if (!value || typeof value !== "object") return null;
  return value as AnswerRow;
}

function asAnswerRows(value: unknown): AnswerRow[] {
  return Array.isArray(value) ? (value as AnswerRow[]) : [];
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
  const last = readNumber(LAST_GOSSIP_TIME_KEY) ?? memoryGossipSentAt;
  if (last == null) return 0;
  return Math.max(0, GOSSIP_COOLDOWN_MS - (Date.now() - last));
}

export function formatGossipClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function markGossipSent(): void {
  memoryGossipSentAt = Date.now();
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_GOSSIP_TIME_KEY, String(memoryGossipSentAt));
  } catch {
    // Private mode may block storage.
  }
}

export function readLastGossipAnswerId(): string | null {
  if (memoryLastAnswerId) return memoryLastAnswerId;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_GOSSIP_ANSWER_KEY);
  } catch {
    return null;
  }
}

export function rememberLastGossipAnswer(id: string): void {
  memoryLastAnswerId = id;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_GOSSIP_ANSWER_KEY, id);
  } catch {
    // ignore
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
  memoryGossipSentAt = null;
  memoryLastAnswerId = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_GOSSIP_TIME_KEY);
    window.localStorage.removeItem(LAST_GOSSIP_ANSWER_KEY);
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
      .select("*")
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
  options?: {
    questionId?: string;
    includeHidden?: boolean;
    limit?: number;
    status?: DailyAnswerStatus | "all";
  },
): Promise<DailyAnswer[]> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return [];
    const limit = options?.limit ?? 40;
    const status = options?.status ?? "approved";
    const run = (columns: string) => {
      let query = supabase
        .from("daily_answers")
        .select(columns)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (options?.questionId) query = query.eq("question_id", options.questionId);
      if (!options?.includeHidden) query = query.eq("is_hidden", false);
      if (status !== "all") query = query.eq("status", status);
      return query;
    };
    let { data, error } = await run(ANSWER_COLUMNS);
    if (error && /status/i.test(error.message)) {
      ({ data, error } = await run(ANSWER_COLUMNS_NO_STATUS));
      if (error && /avatar_url/i.test(error.message)) {
        ({ data, error } = await run(ANSWER_COLUMNS_LEGACY));
      }
      if (error || !Array.isArray(data)) return [];
      const mapped = asAnswerRows(data).map(answerFromRow);
      if (status === "pending") return [];
      return mapped.filter((entry) => options?.includeHidden || !entry.isHidden);
    }
    if (error && /avatar_url/i.test(error.message)) {
      ({ data, error } = await run(ANSWER_COLUMNS_LEGACY));
    }
    if (error || !Array.isArray(data)) return [];
    return asAnswerRows(data)
      .map(answerFromRow)
      .filter((entry) => options?.includeHidden || !entry.isHidden);
  } catch {
    return [];
  }
}

export async function fetchDailyAnswerById(
  id: string,
): Promise<DailyAnswer | null> {
  try {
    const supabase = getSupabase();
    if (!supabase || !id) return null;
    let { data, error } = await supabase
      .from("daily_answers")
      .select(ANSWER_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error && /status/i.test(error.message)) {
      ({ data, error } = await supabase
        .from("daily_answers")
        .select(ANSWER_COLUMNS_NO_STATUS)
        .eq("id", id)
        .maybeSingle());
    }
    if (error && /avatar_url/i.test(error.message)) {
      ({ data, error } = await supabase
        .from("daily_answers")
        .select(ANSWER_COLUMNS_LEGACY)
        .eq("id", id)
        .maybeSingle());
    }
    if (error || !data) return null;
    const row = asAnswerRow(data);
    return row ? answerFromRow(row) : null;
  } catch {
    return null;
  }
}

export type PublishQuestionResult =
  | { ok: true; question: DailyQuestion }
  | { ok: false; error: string };

async function insertDailyQuestion(
  tenantId: string,
  questionText: string,
): Promise<PublishQuestionResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "offline" };
  const text = questionText.trim();
  const { data, error } = await supabase
    .from("daily_questions")
    .insert([
      {
        tenant_id: tenantId,
        prompt: text,
        question: text,
        is_active: true,
      },
    ])
    .select();
  const row = Array.isArray(data) ? data[0] : data;
  if (!error && row) {
    return { ok: true, question: questionFromRow(row as QuestionRow) };
  }
  console.error("Yayınlama hatası:", error);
  const message = error?.message ?? "unknown";
  const fallbackPayload = message.toLowerCase().includes("question")
    ? { tenant_id: tenantId, prompt: text, is_active: true }
    : message.toLowerCase().includes("prompt")
      ? { tenant_id: tenantId, question: text, is_active: true }
      : null;
  if (!fallbackPayload) return { ok: false, error: message };
  const retry = await supabase
    .from("daily_questions")
    .insert([fallbackPayload])
    .select();
  const retryRow = Array.isArray(retry.data) ? retry.data[0] : retry.data;
  if (retry.error || !retryRow) {
    console.error("Yayınlama hatası:", retry.error);
    return { ok: false, error: retry.error?.message ?? message };
  }
  return { ok: true, question: questionFromRow(retryRow as QuestionRow) };
}

export async function publishDailyQuestion(
  tenantId: string,
  questionText: string,
): Promise<PublishQuestionResult> {
  const text = questionText.trim();
  if (!text) return { ok: false, error: "empty" };
  const supabase = getSupabase();
  if (!supabase || !tenantId) return { ok: false, error: "offline" };

  try {
    const deactivated = await supabase
      .from("daily_questions")
      .update({ is_active: false })
      .eq("tenant_id", tenantId);
    if (deactivated.error) {
      console.error("Yayınlama hatası:", deactivated.error);
    }
  } catch (error) {
    console.error("Yayınlama hatası:", error);
  }

  const first = await insertDailyQuestion(tenantId, text);
  if (first.ok) return first;
  if (!first.error.toLowerCase().includes("unique")) return first;

  try {
    await supabase
      .from("daily_questions")
      .update({ is_active: false })
      .eq("tenant_id", tenantId);
  } catch (error) {
    console.error("Yayınlama hatası:", error);
  }
  return insertDailyQuestion(tenantId, text);
}

export async function submitDailyAnswer(input: {
  tenantId: string;
  questionId: string;
  authorLabel: string;
  body: string;
  avatarUrl?: string | null;
}): Promise<
  | { ok: true; answer: DailyAnswer }
  | { ok: false; reason: "blocked" | "wait" | "offline" }
> {
  if (gossipCooldownRemaining() > 0) return { ok: false, reason: "wait" };
  const moderated = moderateGossipText(input.body);
  if (moderated.empty) return { ok: false, reason: "blocked" };
  try {
    const supabase = getSupabase();
    if (!supabase || !input.tenantId) return { ok: false, reason: "offline" };
    const avatarUrl =
      typeof input.avatarUrl === "string" ? input.avatarUrl.trim().slice(0, 160) : "";
    const base = {
      tenant_id: input.tenantId,
      question_id: input.questionId,
      author_label: input.authorLabel.trim().slice(0, 64),
      body: moderated.text,
      is_hidden: false,
      like_count: 0,
      status: moderated.status,
    };
    const withAvatar = avatarUrl
      ? { ...base, avatar_url: avatarUrl }
      : base;
    let row: AnswerRow | null = null;
    let { data, error } = await supabase
      .from("daily_answers")
      .insert(withAvatar as never)
      .select(ANSWER_COLUMNS)
      .single();
    if (error && /status/i.test(error.message)) {
      const { status: _status, ...withoutStatus } = base;
      const payload = avatarUrl
        ? { ...withoutStatus, avatar_url: avatarUrl }
        : withoutStatus;
      ({ data, error } = await supabase
        .from("daily_answers")
        .insert(payload as never)
        .select(ANSWER_COLUMNS_NO_STATUS)
        .single());
      row = asAnswerRow(data);
      if (!error && row && moderated.status === "pending") {
        // Column missing: fall back to hidden so it stays off the public feed.
        await supabase
          .from("daily_answers")
          .update({ is_hidden: true })
          .eq("id", row.id);
        row = { ...row, is_hidden: true, status: "pending" };
      }
    } else {
      row = asAnswerRow(data);
    }
    if (error && /avatar_url/i.test(error.message)) {
      const { status: _s, ...rest } = base;
      ({ data, error } = await supabase
        .from("daily_answers")
        .insert(rest as never)
        .select(ANSWER_COLUMNS_LEGACY)
        .single());
      row = asAnswerRow(data);
    }
    if (error || !row) return { ok: false, reason: "offline" };
    markGossipSent();
    rememberLastGossipAnswer(row.id);
    const answer = answerFromRow(row);
    return {
      ok: true,
      answer: {
        ...answer,
        status: moderated.status,
      },
    };
  } catch {
    return { ok: false, reason: "offline" };
  }
}

export async function approveDailyAnswer(id: string): Promise<DailyAnswer | null> {
  try {
    const supabase = getSupabase();
    if (!supabase || !id) return null;
    const { data, error } = await supabase
      .from("daily_answers")
      .update({ status: "approved", is_hidden: false })
      .eq("id", id)
      .select(ANSWER_COLUMNS)
      .single();
    if (error || !data) return null;
    const row = asAnswerRow(data);
    return row ? answerFromRow(row) : null;
  } catch {
    return null;
  }
}

export async function deleteDailyAnswer(id: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (!supabase || !id) return false;
    const { error } = await supabase.from("daily_answers").delete().eq("id", id);
    return !error;
  } catch {
    return false;
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
    onAnswerDelete?: (id: string) => void;
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
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "daily_answers",
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        const row = payload.old as { id?: string } | undefined;
        if (!row?.id) return;
        handlers.onAnswerDelete?.(row.id);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
