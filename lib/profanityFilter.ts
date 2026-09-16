const BLOCKED = [
  "amk",
  "aq",
  "a.q",
  "a.q.",
  "mk",
  "oç",
  "oc",
  "orospu",
  "orospuçocuğu",
  "orospucocugu",
  "piç",
  "pic",
  "siktir",
  "sikerim",
  "sikeyim",
  "sikiyim",
  "sikik",
  "yarrak",
  "yarak",
  "amına",
  "amina",
  "amcık",
  "amcik",
  "göt",
  "gotunu",
  "götünü",
  "götlek",
  "ibne",
  "pezevenk",
  "gavat",
  "kahpe",
  "şerefsiz",
  "serefsiz",
  "gerizekalı",
  "gerizekali",
  "malafat",
  "fuck",
  "fucker",
  "shit",
  "bitch",
  "asshole",
] as const;

const SPAM = [
  "whatsapp",
  "wa.me",
  "t.me",
  "bit.ly",
  "tinyurl",
  "free followers",
  "bedava takip",
  "takipçi",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenPattern(word: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`,
    "giu",
  );
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

export function filterProfanity(text: string): {
  cleanText: string;
  isClean: boolean;
} {
  let cleanText = sanitizeInput(text);
  let isClean = true;

  for (const word of [...BLOCKED, ...SPAM]) {
    const next = cleanText.replace(tokenPattern(word), "***");
    if (next !== cleanText) isClean = false;
    cleanText = next;
  }

  if (/https?:\/\/|www\./i.test(cleanText)) {
    isClean = false;
    cleanText = cleanText.replace(/https?:\/\/\S+|www\.\S+/gi, "***");
  }

  const visible = cleanText.replace(/[*]+/g, "").replace(/\s+/g, "").trim();
  if (!visible) {
    return { cleanText: "", isClean: false };
  }

  return { cleanText: cleanText.slice(0, 120), isClean };
}
