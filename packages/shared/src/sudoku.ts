/** Boards are 81-char strings, row by row; "0" means empty. */

export const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// How many cells to blank out per difficulty
const HOLES: Record<Difficulty, number> = { easy: 38, medium: 46, hard: 52, expert: 56 };

const row = (i: number) => Math.floor(i / 9);
const col = (i: number) => i % 9;
const box = (i: number) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

function canPlace(cells: number[], i: number, v: number) {
  for (let j = 0; j < 81; j++) {
    if (cells[j] === v && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) {
      return false;
    }
  }
  return true;
}

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Fill the board in place with a random valid solution */
function fill(cells: number[]): boolean {
  const i = cells.indexOf(0);
  if (i === -1) return true;
  for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(cells, i, v)) {
      cells[i] = v;
      if (fill(cells)) return true;
    }
  }
  cells[i] = 0;
  return false;
}

/** Number of solutions, stopping early once it reaches `limit` */
function countSolutions(cells: number[], limit = 2): number {
  const i = cells.indexOf(0);
  if (i === -1) return 1;
  let count = 0;
  for (let v = 1; v <= 9 && count < limit; v++) {
    if (canPlace(cells, i, v)) {
      cells[i] = v;
      count += countSolutions(cells, limit - count);
    }
  }
  cells[i] = 0;
  return count;
}

/** A puzzle with exactly one solution */
export function generateSudoku(difficulty: Difficulty) {
  const solution = Array<number>(81).fill(0);
  fill(solution);

  const puzzle = [...solution];
  let holes = 0;
  for (const i of shuffled([...Array(81).keys()])) {
    if (holes >= HOLES[difficulty]) break;
    const kept = puzzle[i]!;
    puzzle[i] = 0;
    if (countSolutions([...puzzle]) === 1) holes++;
    else puzzle[i] = kept;
  }

  return { puzzle: puzzle.join(""), solution: solution.join("") };
}
