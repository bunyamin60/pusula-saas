/**
 * Cafe table chat moderation.
 * - Whole-token matching (avoids sıkıntı / tamam / akşam false positives)
 * - Elongation-aware (amkkkk, siiiik…) without turning "book" into "bok"
 */

/** Contact / growth spam tokens — keep short forms as whole words only. */
export const BANNED_SPAM = [
  "insta",
  "instagram",
  "dm",
  "wp",
  "whatsapp",
  "05",
  "wa.me",
  "t.me",
  "bit.ly",
  "tinyurl",
  "free followers",
  "bedava takip",
  "takipçi",
  "takipci",
] as const;

/**
 * Common heavy Turkish insults / swears + a few English ones.
 * Prefer multi-letter forms; very short tokens rely on word boundaries.
 */
export const BANNED_WORDS = [
  ...BANNED_SPAM,
  "amk",
  "aq",
  "a.q",
  "a.q.",
  "a q",
  "mk",
  "amq",
  "amck",
  "amcik",
  "amcık",
  "amina",
  "amına",
  "amina koyayim",
  "amina koyayım",
  "amına koyayım",
  "amına koyim",
  "oç",
  "oc",
  "orospu",
  "orospucocugu",
  "orospuçocuğu",
  "orospu cocugu",
  "orospu çocuğu",
  "orospunun",
  "piç",
  "pic",
  "pickur",
  "piçkur",
  "sik",
  "siktir",
  "siktirgit",
  "siktir git",
  "sikerim",
  "sikeyim",
  "sikiyim",
  "sikik",
  "sikko",
  "sikiş",
  "sikis",
  "sikmek",
  "sikildi",
  "sikilmiş",
  "sikilmis",
  "sikiyor",
  "siktiğim",
  "siktigim",
  "siktigimin",
  "siktiğimin",
  "siktirol",
  "siktir ol",
  "yarrak",
  "yarak",
  "yarrrak",
  "yarram",
  "yaram",
  "göt",
  "got",
  "götlek",
  "gotlek",
  "götünü",
  "gotunu",
  "götveren",
  "gotveren",
  "ibne",
  "ibneler",
  "pezevenk",
  "pezeveng",
  "gavat",
  "kahpe",
  "kahbe",
  "şerefsiz",
  "serefsiz",
  "şerefsizler",
  "serefsizler",
  "gerizekalı",
  "gerizekali",
  "geri zekalı",
  "geri zekali",
  "malafat",
  "hassiktir",
  "hasiktir",
  "amını",
  "amini",
  "amcığı",
  "amcigi",
  "dalyarak",
  "dalyarrak",
  "sikiksin",
  "siktirlan",
  "ananı",
  "anani",
  "ananısikeyim",
  "anani sikeyim",
  "ananı sikeyim",
  "ananısikerim",
  "anani sikerim",
  "bacını",
  "bacini",
  "götü",
  "gotu",
  "götler",
  "gotler",
  "yavşak",
  "yavsak",
  "puşt",
  "pust",
  "godoş",
  "godos",
  "bok",
  "boktan",
  "boklu",
  "sıçmak",
  "sicmak",
  "sıçarım",
  "sicirim",
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "asshole",
  "dick",
  "cunt",
  "whore",
  "slut",
] as const;

/** Short slang that users commonly stretch (amkkkk, siik…). */
const STRETCH_SLANG = new Set([
  "amk",
  "amq",
  "aq",
  "mk",
  "oc",
  "oç",
  "sik",
  "pic",
  "piç",
  "got",
  "göt",
  "amck",
  "amcik",
  "amcık",
  "ibne",
  "bok",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function foldTurkish(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/** Collapse only 3+ repeats so "book" stays "book", "amkkkk" → "amk". */
function collapseHeavyRepeats(value: string): string {
  return value.replace(/(.)\1{2,}/gu, "$1");
}

function stripSeparators(value: string): string {
  return value.replace(/[.\-_*/\\|]+/g, "");
}

function hasHeavyStretch(value: string): boolean {
  return /(.)\1{2,}/u.test(value);
}

function exactTokenPattern(word: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`,
    "giu",
  );
}

/** amk → a+m+k+ matches amkkkk as a whole token; sıkıntı → sikinti does not match sik. */
function elongatedTokenPattern(word: string): RegExp {
  const folded = foldTurkish(word);
  if (!folded || /\s/.test(folded)) return exactTokenPattern(word);
  const body = [...folded]
    .map((ch) => `${escapeRegExp(ch)}+`)
    .join("");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu");
}

export function sanitizeInput(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:\s*text\/html/gi, "")
    .replace(/\bon\w+\s*=/gi, "")
    .replace(/&#x?[0-9a-f]+;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasUrlSpam(text: string): boolean {
  return /https?:\/\/|www\./i.test(text);
}

function tokensOf(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:[.\-_*/\\|]+[\p{L}\p{N}]+)*/gu) ?? [];
}

const BANNED_FOLDED = new Set(
  BANNED_WORDS.map((word) =>
    collapseHeavyRepeats(stripSeparators(foldTurkish(word))),
  ),
);

export function hasBannedContent(text: string): boolean {
  const sample = sanitizeInput(text);
  if (!sample) return false;
  if (hasUrlSpam(sample)) return true;

  const foldedSample = foldTurkish(sample);

  for (const word of BANNED_WORDS) {
    if (exactTokenPattern(word).test(sample)) return true;
    if (exactTokenPattern(foldTurkish(word)).test(foldedSample)) return true;

    const foldedWord = foldTurkish(word);
    const allowStretch =
      STRETCH_SLANG.has(foldedWord) || foldedWord.length >= 5;
    if (allowStretch && elongatedTokenPattern(word).test(foldedSample)) {
      return true;
    }
  }

  // Stretched tokens: amkkkk → amk (requires 3+ same letter in a row)
  for (const token of tokensOf(sample)) {
    if (!hasHeavyStretch(token)) continue;
    const collapsed = collapseHeavyRepeats(
      stripSeparators(foldTurkish(token)),
    );
    if (BANNED_FOLDED.has(collapsed)) return true;
  }

  return false;
}

export type GossipModeration = {
  text: string;
  status: "approved" | "pending";
  empty: boolean;
};

/** Sanitize + decide approved vs pending (do not mask words — admin must read pending). */
export function moderateGossipText(text: string): GossipModeration {
  const sanitized = sanitizeInput(text).slice(0, 120);
  if (!sanitized) return { text: "", status: "pending", empty: true };
  const flagged = hasBannedContent(sanitized);
  return {
    text: sanitized,
    status: flagged ? "pending" : "approved",
    empty: false,
  };
}

/** @deprecated Prefer moderateGossipText for gossip; kept for legacy callers. */
export function filterProfanity(text: string): {
  cleanText: string;
  isClean: boolean;
} {
  const result = moderateGossipText(text);
  if (result.empty) return { cleanText: "", isClean: false };
  return { cleanText: result.text, isClean: result.status === "approved" };
}
