export const BOARD_SIZE = 8;
export const TRAY_SIZE = 3;
export const PLACE_POINTS = 10;
export const LINE_POINTS = 80;
export const REWARD_THRESHOLDS = [10000] as const;

export type BlockColorId = 1 | 2 | 3 | 4 | 5;
export type BoardCell = 0 | BlockColorId;
export type Board = BoardCell[][];

export type BlockOffset = { r: number; c: number };

export type BlockShape = {
  id: string;
  colorId: BlockColorId;
  colorClass: string;
  cells: BlockOffset[];
};

const CUBE =
  "rounded-md border-t-2 border-l-2 border-white/60 border-b-2 border-r-2 border-black/40 shadow-inner";

export const BLOCK_COLOR_CLASS: Record<BlockColorId, string> = {
  1: `bg-orange-500 ${CUBE}`,
  2: `bg-violet-500 ${CUBE}`,
  3: `bg-cyan-400 ${CUBE}`,
  4: `bg-yellow-400 ${CUBE}`,
  5: `bg-pink-400 ${CUBE}`,
};

function normalize(cells: Array<[number, number]>): BlockOffset[] {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells
    .map(([r, c]) => ({ r: r - minR, c: c - minC }))
    .sort((a, b) => a.r - b.r || a.c - b.c);
}

function rotate(cells: Array<[number, number]>): Array<[number, number]> {
  return cells.map(([r, c]) => [c, -r]);
}

function keyOf(cells: BlockOffset[]): string {
  return cells.map((cell) => `${cell.r},${cell.c}`).join("|");
}

function rotations(
  id: string,
  colorId: BlockColorId,
  base: Array<[number, number]>,
): BlockShape[] {
  const out: BlockShape[] = [];
  const seen = new Set<string>();
  let current = base;
  for (let index = 0; index < 4; index += 1) {
    const cells = normalize(current);
    const key = keyOf(cells);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        id: `${id}_${index}`,
        colorId,
        colorClass: BLOCK_COLOR_CLASS[colorId],
        cells,
      });
    }
    current = rotate(current);
  }
  return out;
}

function mono(
  id: string,
  colorId: BlockColorId,
  cells: Array<[number, number]>,
): BlockShape {
  return {
    id,
    colorId,
    colorClass: BLOCK_COLOR_CLASS[colorId],
    cells: normalize(cells),
  };
}

export const BLOCK_SHAPES: BlockShape[] = [
  mono("o1", 4, [[0, 0]]),
  mono("i2h", 1, [[0, 0], [0, 1]]),
  mono("i2v", 1, [[0, 0], [1, 0]]),
  mono("i3h", 3, [[0, 0], [0, 1], [0, 2]]),
  mono("i3v", 3, [[0, 0], [1, 0], [2, 0]]),
  mono("i4h", 2, [[0, 0], [0, 1], [0, 2], [0, 3]]),
  mono("i4v", 2, [[0, 0], [1, 0], [2, 0], [3, 0]]),
  mono("i5h", 5, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]),
  mono("i5v", 5, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]),
  mono("sq2", 4, [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]),
  mono("sq3", 1, [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ]),
  ...rotations("l2", 5, [
    [0, 0],
    [1, 0],
    [1, 1],
  ]),
  ...rotations("j2", 5, [
    [0, 1],
    [1, 0],
    [1, 1],
  ]),
  ...rotations("l3", 2, [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ]),
  ...rotations("j3", 2, [
    [0, 1],
    [1, 1],
    [2, 0],
    [2, 1],
  ]),
  ...rotations("l33", 1, [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
  ]),
  ...rotations("t3", 3, [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
  ]),
  ...rotations("t4", 4, [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [2, 1],
  ]),
];

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 0 as BoardCell),
  );
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function boundingBox(cells: BlockOffset[]): { rows: number; cols: number } {
  return {
    rows: Math.max(...cells.map((cell) => cell.r)) + 1,
    cols: Math.max(...cells.map((cell) => cell.c)) + 1,
  };
}

export function pieceFits(
  board: Board,
  cells: BlockOffset[],
  row: number,
  col: number,
): boolean {
  return cells.every((cell) => {
    const nextRow = row + cell.r;
    const nextCol = col + cell.c;
    return (
      nextRow >= 0 &&
      nextRow < BOARD_SIZE &&
      nextCol >= 0 &&
      nextCol < BOARD_SIZE &&
      board[nextRow]?.[nextCol] === 0
    );
  });
}

export function canPieceFitAnywhere(board: Board, cells: BlockOffset[]): boolean {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (pieceFits(board, cells, row, col)) return true;
    }
  }
  return false;
}

export function placePiece(
  board: Board,
  cells: BlockOffset[],
  row: number,
  col: number,
  colorId: BlockColorId,
): Board {
  const next = cloneBoard(board);
  for (const cell of cells) {
    next[row + cell.r]![col + cell.c] = colorId;
  }
  return next;
}

export function findFullLines(board: Board): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (board[row]?.every((cell) => cell !== 0)) rows.push(row);
  }
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    if (board.every((line) => line[col] !== 0)) cols.push(col);
  }
  return { rows, cols };
}

export function clearLines(
  board: Board,
  rows: number[],
  cols: number[],
): Board {
  const next = cloneBoard(board);
  for (const row of rows) {
    for (let col = 0; col < BOARD_SIZE; col += 1) next[row]![col] = 0;
  }
  for (const col of cols) {
    for (let row = 0; row < BOARD_SIZE; row += 1) next[row]![col] = 0;
  }
  return next;
}

export function blastPreview(
  board: Board,
  cells: BlockOffset[],
  row: number,
  col: number,
  colorId: BlockColorId,
): { piece: string[]; blast: string[] } {
  if (!pieceFits(board, cells, row, col)) {
    return { piece: [], blast: [] };
  }
  const piece = cells.map((cell) => `${row + cell.r}-${col + cell.c}`);
  const placed = placePiece(board, cells, row, col, colorId);
  const lines = findFullLines(placed);
  return { piece, blast: lineClearKeys(lines.rows, lines.cols) };
}

export function lineClearKeys(rows: number[], cols: number[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (let col = 0; col < BOARD_SIZE; col += 1) keys.add(`${row}-${col}`);
  }
  for (const col of cols) {
    for (let row = 0; row < BOARD_SIZE; row += 1) keys.add(`${row}-${col}`);
  }
  return [...keys];
}

export function dealTray(count = TRAY_SIZE): BlockShape[] {
  return Array.from({ length: count }, () => {
    const pick = BLOCK_SHAPES[Math.floor(Math.random() * BLOCK_SHAPES.length)];
    return pick ?? BLOCK_SHAPES[0]!;
  });
}

export function anyTrayPieceFits(
  board: Board,
  tray: Array<BlockShape | null>,
): boolean {
  return tray.some((piece) => piece != null && canPieceFitAnywhere(board, piece.cells));
}
