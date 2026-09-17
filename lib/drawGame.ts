import { tenantConfig } from "@/config/tenant.config";

export const DRAW_PICK_MS = 5_000;
export const DRAW_WARN_MS = 3_000;
export const DRAW_TURN_MS = 60_000;
export const DRAW_REVEAL_MS = 5_000;
export const DRAW_OVER_MS = 10_000;
export const DRAW_STROKE_MS = 40;
export const DRAW_MIN_PLAYERS = 2;
export const DRAW_MAX_SNAPSHOT_STROKES = 80;

export type DrawPhase = "lobby" | "pick" | "warn" | "draw" | "reveal" | "over";

export type DrawOccupant = {
  clientId: string;
  nickname: string;
  avatar: string;
};

export type DrawPoint = { x: number; y: number };

export type DrawStroke = {
  id: string;
  seq: number;
  color: string;
  width: number;
  points: DrawPoint[];
};

export type DrawChatKind =
  | "wrong"
  | "correct"
  | "system"
  | "vote"
  | "join"
  | "leave"
  | "skip";

export type DrawChatMessage = {
  id: string;
  kind: DrawChatKind;
  clientId: string;
  nickname: string;
  avatar: string;
  text?: string;
  targetId?: string;
  targetName?: string;
};

export type DrawScores = Record<string, number>;

export type DrawRoundState = {
  phase: DrawPhase;
  painterId: string | null;
  options: string[];
  word: string | null;
  endsAt: number;
  scores: DrawScores;
  correctIds: string[];
  round: number;
  painterOrder: string[];
};

export function cafeDrawRoomId(tenantId: string): string {
  return `draw_room_${tenantId}_main`;
}

export function privateDrawRoomId(tenantId: string, pin: string): string {
  return `draw_room_${tenantId}_${pin}`;
}

export function makeDrawPin(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

export function parseDrawPin(raw: string): string | null {
  const pin = raw.replace(/\D/g, "").slice(0, 4);
  return pin.length === 4 ? pin : null;
}

export function pinFromRoomId(roomId: string): string | null {
  const match = /_(\d{4})$/.exec(roomId);
  return match ? match[1] : null;
}

export function isCafeDrawRoom(roomId: string): boolean {
  return roomId.endsWith("_main");
}

export function painterOrderOf(occupants: DrawOccupant[]): string[] {
  return occupants.map((entry) => entry.clientId).sort((a, b) => a.localeCompare(b));
}

export function emptyDrawRound(): DrawRoundState {
  return {
    phase: "lobby",
    painterId: null,
    options: [],
    word: null,
    endsAt: 0,
    scores: {},
    correctIds: [],
    round: 0,
    painterOrder: [],
  };
}

export function electDrawHost(ids: string[]): string | null {
  if (ids.length === 0) return null;
  return [...ids].sort((a, b) => a.localeCompare(b))[0];
}

export function nextPainterId(
  order: string[],
  current: string | null,
  previousOrder: string[] = [],
): string | null {
  const live = order.filter(Boolean);
  if (live.length === 0) return null;
  if (current == null) return live[0];
  const index = live.indexOf(current);
  if (index !== -1) return live[(index + 1) % live.length];
  const prevIndex = previousOrder.indexOf(current);
  if (prevIndex === -1) return live[0];
  for (let step = 1; step <= previousOrder.length; step += 1) {
    const candidate = previousOrder[(prevIndex + step) % previousOrder.length];
    if (live.includes(candidate)) return candidate;
  }
  return live[0];
}

export function pickDrawWords(count = 3): string[] {
  const pool = [...tenantConfig.duel.draw.words];
  const chosen: string[] = [];
  while (chosen.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(index, 1)[0]);
  }
  return chosen;
}

export function guessPointsForIndex(index: number): number {
  const ladder = tenantConfig.duel.draw.guessPoints;
  return ladder[index] ?? ladder[ladder.length - 1] ?? 5;
}

export function drawPainterBonus(): number {
  return tenantConfig.duel.draw.painterBonus;
}

export function kickThreshold(playerCount: number): number {
  return Math.max(2, Math.ceil(playerCount * 0.5));
}

export function drawWinScore(): number {
  return tenantConfig.duel.draw.winScore;
}

export function formatDrawHint(word: string, revealedCount: number): string {
  let left = revealedCount;
  const out: string[] = [];
  for (const char of [...word]) {
    if (char === " ") {
      out.push(" ");
      continue;
    }
    if (left > 0) {
      out.push(char.toLocaleUpperCase("tr-TR"));
      left -= 1;
    } else {
      out.push("_");
    }
  }
  return out.join(" ");
}

export function extraHintCount(elapsedRatio: number, letterCount: number): number {
  let revealed = 0;
  if (elapsedRatio >= 0.5) revealed = 1;
  if (elapsedRatio >= 0.82) revealed = 2;
  return Math.min(revealed, Math.max(0, letterCount - 1));
}

export function wordLetterCount(word: string): number {
  return [...word].filter((char) => char.trim() !== "").length;
}

export function normalizeGuess(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "");
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0),
  );
  for (let i = 0; i < rows; i += 1) grid[i][0] = i;
  for (let j = 0; j < cols; j += 1) grid[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      grid[i][j] = Math.min(
        grid[i - 1][j] + 1,
        grid[i][j - 1] + 1,
        grid[i - 1][j - 1] + cost,
      );
    }
  }
  return grid[a.length][b.length];
}

export type DrawGuessVerdict = "correct" | "close" | "miss";

export function allowedDrawDistance(word: string): number {
  return normalizeGuess(word).length <= 5 ? 0 : 1;
}

export function scoreDrawGuess(guess: string, word: string): DrawGuessVerdict {
  const left = normalizeGuess(guess);
  const right = normalizeGuess(word);
  if (!left || !right) return "miss";
  if (left === right) return "correct";
  const distance = levenshtein(left, right);
  if (distance <= allowedDrawDistance(word)) return "correct";
  if (distance === 2) return "close";
  return "miss";
}

export function isFuzzyMatch(guess: string, word: string): boolean {
  return scoreDrawGuess(guess, word) === "correct";
}

export function withOccupantScores(
  scores: DrawScores,
  occupants: DrawOccupant[],
): DrawScores {
  const next = { ...scores };
  for (const occupant of occupants) {
    if (next[occupant.clientId] == null) next[occupant.clientId] = 0;
  }
  return next;
}

export function mergeStroke(
  strokes: DrawStroke[],
  incoming: DrawStroke,
): DrawStroke[] {
  const index = strokes.findIndex((stroke) => stroke.id === incoming.id);
  if (index === -1) return [...strokes, incoming];
  const current = strokes[index];
  const last = current.points[current.points.length - 1];
  const extra =
    last &&
    incoming.points[0] &&
    last.x === incoming.points[0].x &&
    last.y === incoming.points[0].y
      ? incoming.points.slice(1)
      : incoming.points;
  const next = [...strokes];
  next[index] = {
    ...current,
    seq: Math.max(current.seq, incoming.seq),
    points: [...current.points, ...extra],
  };
  return next;
}

