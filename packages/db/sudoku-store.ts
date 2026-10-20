import { redis } from "./redis";
import { generateSudoku, type Difficulty } from "@repo/shared/sudoku";

const MAX_MISTAKES = 3;

type SudokuStatus = "waiting" | "active" | "completed";

interface SudokuRecord {
  id: string;
  players: string[];
  difficulty: Difficulty;
  status: SudokuStatus;
  puzzle: string;
  solution: string;
  // Who filled each cell (null for givens and empty cells)
  owners: (string | null)[];
  mistakes: Record<string, number>;
  winner: string | null;
  endReason: "solved" | "mistakes" | null;
  startedAt: number | null;
  createdAt: string;
}

const SUDOKU_KEY = (id: string) => `sudoku:${id}`;
// Same idea as the chess active-game pointer, so reconnects resume the puzzle
const ACTIVE_SUDOKU_KEY = (userId: string) => `user:${userId}:active-sudoku`;

class SudokuStore {
  async find(id: string): Promise<SudokuRecord | null> {
    const data = await redis.get(SUDOKU_KEY(id));
    return data ? JSON.parse(data) : null;
  }

  private async save(game: SudokuRecord) {
    await redis.set(SUDOKU_KEY(game.id), JSON.stringify(game));
  }

  async create(playerId: string, difficulty: Difficulty): Promise<SudokuRecord> {
    const { puzzle, solution } = generateSudoku(difficulty);
    const game: SudokuRecord = {
      id: crypto.randomUUID(),
      players: [playerId],
      difficulty,
      status: "waiting",
      puzzle,
      solution,
      owners: Array(81).fill(null),
      mistakes: { [playerId]: 0 },
      winner: null,
      endReason: null,
      startedAt: null,
      createdAt: new Date().toISOString(),
    };
    await this.save(game);
    await redis.set(ACTIVE_SUDOKU_KEY(playerId), game.id);
    return game;
  }

  async join(id: string, playerId: string): Promise<SudokuRecord> {
    const game = await this.find(id);
    if (!game) throw new Error("Game not found");
    if (game.status !== "waiting" || game.players.length >= 2) throw new Error("Game is full");

    game.players.push(playerId);
    game.mistakes[playerId] = 0;
    game.status = "active";
    game.startedAt = Date.now();
    await this.save(game);
    await redis.set(ACTIVE_SUDOKU_KEY(playerId), game.id);
    return game;
  }

  /** Place a digit. Returns whether it was correct and the updated game. */
  async place(id: string, playerId: string, index: number, value: number) {
    const game = await this.find(id);
    if (!game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game is not active");
    if (!game.players.includes(playerId)) throw new Error("You are not in this game");
    if (game.puzzle[index] !== "0" || game.owners[index]) throw new Error("Cell already filled");

    const correct = game.solution[index] === String(value);
    if (correct) {
      game.owners[index] = playerId;
    } else {
      game.mistakes[playerId] = (game.mistakes[playerId] ?? 0) + 1;
    }

    const empty = [...game.puzzle].filter((c, i) => c === "0" && !game.owners[i]).length;
    if (game.mistakes[playerId]! >= MAX_MISTAKES) {
      game.winner = game.players.find((p) => p !== playerId) ?? null;
      game.endReason = "mistakes";
    } else if (empty === 0) {
      const [a, b] = game.players.map((p) => game.owners.filter((o) => o === p).length);
      game.winner = a === b ? null : a! > b! ? game.players[0]! : game.players[1]!;
      game.endReason = "solved";
    }
    if (game.endReason) {
      game.status = "completed";
      await redis.del(...game.players.map(ACTIVE_SUDOKU_KEY));
    }

    await this.save(game);
    return { correct, game };
  }

  async findActive(userId: string): Promise<SudokuRecord | null> {
    const id = await redis.get(ACTIVE_SUDOKU_KEY(userId));
    if (!id) return null;
    const game = await this.find(id);
    if (!game || game.status === "completed") {
      await redis.del(ACTIVE_SUDOKU_KEY(userId));
      return null;
    }
    return game;
  }
}

export const sudokuStore = new SudokuStore();
export { MAX_MISTAKES };
export type { SudokuRecord };
