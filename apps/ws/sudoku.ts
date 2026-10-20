import { WebSocket } from "ws";
import { events } from "@repo/shared/events";
import { DIFFICULTIES, type Difficulty } from "@repo/shared/sudoku";
import { sudokuStore, MAX_MISTAKES, type SudokuRecord } from "@repo/db/sudoku-store";
import { connections, send, sendError } from "./handlers";

// Serialize writes per game so two players placing at once can't clobber each other
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
  const run = (locks.get(gameId) ?? Promise.resolve()).then(fn, fn);
  locks.set(gameId, run.catch(() => {}));
  return run;
}

/** Everything the client needs, minus the solution */
function sudokuState(game: SudokuRecord) {
  return {
    gameId: game.id,
    status: game.status,
    difficulty: game.difficulty,
    puzzle: game.puzzle,
    // Givens plus correctly claimed cells (never the unsolved ones)
    board: [...game.puzzle].map((c, i) => (game.owners[i] ? game.solution[i] : c)).join(""),
    owners: game.owners,
    players: game.players,
    mistakes: game.mistakes,
    maxMistakes: MAX_MISTAKES,
    winner: game.winner,
    endReason: game.endReason,
    elapsedMs: game.startedAt ? Date.now() - game.startedAt : 0,
  };
}

function syncAll(game: SudokuRecord) {
  for (const p of game.players) {
    const ws = connections.get(p);
    if (ws && ws.readyState === WebSocket.OPEN) send(ws, events.sudokuSync, sudokuState(game));
  }
}

export async function syncSudoku(ws: WebSocket, userId: string) {
  const game = await sudokuStore.findActive(userId);
  if (game) send(ws, events.sudokuSync, sudokuState(game));
}

export async function handleSudokuCreate(ws: WebSocket, userId: string, payload?: Record<string, unknown>) {
  try {
    const difficulty = payload?.difficulty as Difficulty;
    if (!DIFFICULTIES.includes(difficulty)) return sendError(ws, "Invalid difficulty");
    const game = await sudokuStore.create(userId, difficulty);
    send(ws, events.sudokuSync, sudokuState(game));
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

/** Returns false if gameId isn't a sudoku game (so the caller tries chess) */
export async function tryJoinSudoku(ws: WebSocket, userId: string, gameId: string): Promise<boolean> {
  const existing = await sudokuStore.find(gameId);
  if (!existing) return false;
  try {
    if (existing.players.includes(userId)) {
      send(ws, events.sudokuSync, sudokuState(existing));
    } else {
      syncAll(await withLock(gameId, () => sudokuStore.join(gameId, userId)));
    }
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
  return true;
}

export async function handleSudokuPlace(ws: WebSocket, userId: string, payload?: Record<string, unknown>) {
  try {
    const gameId = payload?.gameId as string;
    const index = payload?.index as number;
    const value = payload?.value as number;
    if (!gameId || !Number.isInteger(index) || index < 0 || index > 80) {
      return sendError(ws, "Invalid cell");
    }
    if (!Number.isInteger(value) || value < 1 || value > 9) return sendError(ws, "Invalid value");

    const { correct, game } = await withLock(gameId, () =>
      sudokuStore.place(gameId, userId, index, value),
    );
    if (!correct) send(ws, events.sudokuWrong, { index, value });
    syncAll(game);
  } catch (err) {
    // Losing a race for the same cell just resyncs the board
    const game = await sudokuStore.find(payload?.gameId as string).catch(() => null);
    if (game) send(ws, events.sudokuSync, sudokuState(game));
    sendError(ws, (err as Error).message);
  }
}
